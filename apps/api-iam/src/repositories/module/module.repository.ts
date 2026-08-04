import type { PrismaClient } from '../../generated/prisma/client.js'
import type { Module, EffectiveModule, AvailableProduct } from '../../domain/index.js'
import { NotFoundError, ValidationError } from '../../errors.js'

export type ModuleRepository = {
  findAll(productId?: string): Promise<Module[]>
  // The products a tenant can reach: an active subscription, or a live grant
  // Entitlement (trial/admin/override). Same access model as
  // resolveEffectiveModules, one level up.
  findAvailableProducts(tenantId: string): Promise<AvailableProduct[]>
  findAllActiveProducts(): Promise<AvailableProduct[]>
  findById(id: string): Promise<Module | null>
  // Legacy resolver (pre-a3). Kept available for one release per the design
  // rollout notes — rollback lever if the a3 switch needs to be reverted.
  findEffectiveForTenant(planId: string, tenantId: string): Promise<EffectiveModule[]>
  // a3: effective modules = (plan live-join ∪ grant Entitlements) − revoke
  // Entitlements, scoped to (tenantId, productId).
  resolveEffectiveModules(tenantId: string, productId: string, userId?: string): Promise<EffectiveModule[]>
  // productId is required: an orphan module can't be sold through any plan
  // (see setPlanModules), so creating one is always a mistake.
  create(data: { id: string; name: string; description?: string; defaultUrl: string; productId: string; parentId?: string }): Promise<Module>
  update(id: string, data: Partial<{ name: string; description: string; defaultUrl: string; active: boolean }>): Promise<Module>
  delete(id: string): Promise<void>
  setPlanModules(planId: string, moduleIds: string[]): Promise<void>
  findPlanModules(planId: string): Promise<{ moduleId: string }[]>
  // Both return the module's productId so the caller can purge the right
  // entitlements cache.
  upsertTenantOverride(tenantId: string, moduleId: string, enabled: boolean, createdBy?: string, reason?: string): Promise<string>
  deleteTenantOverride(tenantId: string, moduleId: string): Promise<string>
  // b1 (5.1) + b1.5 (PR7, owner decision #1679/1): tenant-level trial grant —
  // Entitlement(source: trial, kind: grant). moduleId: null means a
  // whole-product grant (resolveEffectiveModules expands it to every module
  // of the product). Prisma's generated compound-unique input for a
  // nullable @@unique member doesn't accept null, so the null case uses
  // findFirst+create/update inside a $transaction instead of the compound
  // upsert used for the module-scoped case.
  grantTrial(tenantId: string, productId: string, moduleId: string | null, expiresAt: Date, createdBy?: string, reason?: string): Promise<void>
  // b1 (5.2): deletes expired trial grants (hygiene — resolveEffectiveModules
  // already excludes them at read time) and returns the affected (tenant,
  // product) pairs for the caller to fan out a cache purge.
  sweepExpiredTrials(): Promise<{ tenantId: string; productId: string }[]>
}

export function createModuleRepository(prisma: PrismaClient): ModuleRepository {
  return {
    async findAll(productId) {
      const rows = await prisma.module.findMany({
        ...(productId !== undefined ? { where: { productId } } : {}),
        orderBy: { id: 'asc' },
      })
      return rows.map(toModule)
    },

    async findById(id) {
      const row = await prisma.module.findUnique({ where: { id } })
      return row ? toModule(row) : null
    },

    async findAvailableProducts(tenantId) {
      const now = new Date()
      const [subscriptions, entitlements] = await Promise.all([
        prisma.tenantProductSubscription.findMany({
          where: { tenantId, status: 'active' },
          include: { product: true },
        }),
        prisma.entitlement.findMany({
          where: {
            tenantId,
            kind: 'grant',
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          include: { product: true },
        }),
      ])

      const byId = new Map<string, AvailableProduct>()
      for (const row of [...subscriptions, ...entitlements]) {
        if (!row.product.active) continue
        byId.set(row.product.id, toProduct(row.product))
      }
      return Array.from(byId.values())
    },

    async findAllActiveProducts() {
      const rows = await prisma.product.findMany({ where: { active: true }, orderBy: { id: 'asc' } })
      return rows.map(toProduct)
    },

    async findEffectiveForTenant(planId, tenantId) {
      const [planModules, overrides] = await Promise.all([
        prisma.planModule.findMany({
          where: { planId, module: { active: true } },
          include: { module: true },
        }),
        prisma.tenantModuleOverride.findMany({
          where: { tenantId },
          include: { module: true },
        }),
      ])

      const result = new Map<string, EffectiveModule>()

      for (const pm of planModules) {
        result.set(pm.moduleId, { ...toModule(pm.module), effectiveUrl: pm.module.defaultUrl, source: 'plan' })
      }

      for (const ov of overrides) {
        if (!ov.module.active) continue
        if (ov.enabled) {
          result.set(ov.moduleId, { ...toModule(ov.module), effectiveUrl: ov.module.defaultUrl, source: 'override' })
        } else {
          result.delete(ov.moduleId)
        }
      }

      return Array.from(result.values())
    },

    async resolveEffectiveModules(tenantId, productId, userId) {
      const now = new Date()
      const [subscription, entitlements] = await Promise.all([
        prisma.tenantProductSubscription.findUnique({
          where: { tenantId_productId: { tenantId, productId } },
        }),
        prisma.entitlement.findMany({
          where: {
            tenantId,
            productId,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          include: { module: true },
        }),
      ])

      const result = new Map<string, EffectiveModule>()

      if (subscription) {
        const planModules = await prisma.planModule.findMany({
          where: { planId: subscription.planId, module: { active: true } },
          include: { module: true },
        })
        for (const pm of planModules) {
          result.set(pm.moduleId, { ...toModule(pm.module), effectiveUrl: pm.module.defaultUrl, source: 'plan' })
        }
      }

      // b1.5 (PR7, owner decision #1679/1): a product-scoped entitlement
      // (moduleId: null) applies to every module of the product — fetch the
      // product's active modules only when one is actually present.
      const hasProductScoped = entitlements.some((ent) => ent.moduleId === null)
      const productModules = hasProductScoped
        ? await prisma.module.findMany({ where: { productId, active: true } })
        : []

      // Precedence: (plan ∪ all grants [module + product-expanded]) − all
      // revokes [module + product-expanded] — a revoke at EITHER scope wins,
      // so revokes are always applied after every grant.
      for (const ent of entitlements) {
        if (ent.kind !== 'grant') continue
        if (ent.moduleId) {
          if (!ent.module?.active) continue
          result.set(ent.moduleId, { ...toModule(ent.module), effectiveUrl: ent.module.defaultUrl, source: ent.source })
        } else {
          for (const module of productModules) {
            result.set(module.id, { ...toModule(module), effectiveUrl: module.defaultUrl, source: ent.source })
          }
        }
      }

      for (const ent of entitlements) {
        if (ent.kind !== 'revoke') continue
        if (ent.moduleId) {
          result.delete(ent.moduleId)
        } else {
          for (const module of productModules) result.delete(module.id)
        }
      }

      // Phase 1 sub-module cascading: fetch all active modules for this
      // product to build a parent→children map, then auto-include children
      // whose parent is already in the result set (same source).
      const allModules = await prisma.module.findMany({
        where: { productId, active: true },
      })
      const childrenOf = new Map<string, typeof allModules>()
      const moduleById = new Map(allModules.map(m => [m.id, m]))
      for (const m of allModules) {
        if (m.parentId) {
          const list = childrenOf.get(m.parentId) ?? []
          list.push(m)
          childrenOf.set(m.parentId, list)
        }
      }

      for (const [moduleId, entry] of result) {
        const children = childrenOf.get(moduleId)
        if (!children) continue
        for (const child of children) {
          if (!result.has(child.id)) {
            result.set(child.id, { ...toModule(child), effectiveUrl: entry.effectiveUrl, source: entry.source })
          }
        }
      }

      // Phase 2 role filtering: when userId is provided, intersect the
      // result with the modules permitted by the user's product roles.
      if (userId) {
        const userRoles = await prisma.userProductRole.findMany({
          where: { userId },
          include: { productRole: true },
        });
        const productRoleIds = userRoles
          .filter((ur) => ur.productRole.productId === productId)
          .map((ur) => ur.productRoleId);

        if (productRoleIds.length > 0) {
          const permittedModules = await prisma.roleModuleAccess.findMany({
            where: { productRoleId: { in: productRoleIds } },
            select: { moduleId: true },
          });
          const permittedIds = new Set(permittedModules.map((r) => r.moduleId));
          for (const moduleId of result.keys()) {
            if (!permittedIds.has(moduleId)) {
              result.delete(moduleId);
            }
          }
        }
      }

      return Array.from(result.values())
    },

    async create(data) {
      const product = await prisma.product.findUnique({ where: { id: data.productId } })
      if (!product) throw new NotFoundError('product.not_found', `Unknown product '${data.productId}'`)

      if (data.parentId !== undefined) {
        const parent = await prisma.module.findUnique({ where: { id: data.parentId } })
        if (!parent) throw new NotFoundError('modules.not_found', `Unknown parent '${data.parentId}'`)
        if (parent.productId !== data.productId) {
          throw new ValidationError(
            'modules.product_mismatch',
            `Parent '${data.parentId}' belongs to product '${parent.productId ?? 'none'}'`,
          )
        }
        // Sub-module nesting is 1 level max (see schema.prisma Module.parentId).
        if (parent.parentId !== null) {
          throw new ValidationError(
            'modules.nesting_too_deep',
            `Parent '${data.parentId}' is already a sub-module`,
          )
        }
      }

      const row = await prisma.module.create({ data })
      return toModule(row)
    },

    async update(id, data) {
      const row = await prisma.module.update({ where: { id }, data })
      return toModule(row)
    },

    async delete(id) {
      await prisma.module.delete({ where: { id } })
    },

    async setPlanModules(planId, moduleIds) {
      // A module belongs to exactly one product and can only be sold through
      // plans of that same product — the invariant is enforced here because
      // this is the only write path into plan_modules.
      const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { productId: true } })
      if (!plan) throw new NotFoundError('plans.not_found')

      if (moduleIds.length > 0 && plan.productId !== null) {
        const modules = await prisma.module.findMany({
          where: { id: { in: moduleIds } },
          select: { id: true, productId: true },
        })

        const found = new Set(modules.map((m) => m.id))
        const missing = moduleIds.filter((id) => !found.has(id))
        if (missing.length > 0) {
          throw new NotFoundError('modules.not_found', `Unknown modules: ${missing.join(', ')}`)
        }

        const foreign = modules.filter((m) => m.productId !== plan.productId)
        if (foreign.length > 0) {
          throw new ValidationError(
            'modules.product_mismatch',
            `Modules do not belong to product '${plan.productId}': ${foreign.map((m) => m.id).join(', ')}`,
            foreign.map((m) => ({
              field: 'moduleIds',
              code: 'modules.product_mismatch',
              message: `Module '${m.id}' belongs to product '${m.productId ?? 'none'}'`,
            })),
          )
        }
      }

      await prisma.$transaction([
        prisma.planModule.deleteMany({ where: { planId } }),
        ...moduleIds.map((moduleId) =>
          prisma.planModule.create({ data: { planId, moduleId } })
        ),
      ])
    },

    async findPlanModules(planId) {
      return prisma.planModule.findMany({
        where: { planId },
        select: { moduleId: true },
      })
    },

    async upsertTenantOverride(tenantId, moduleId, enabled, createdBy, reason) {
      // a3 (owner-confirmed #1675): a disabled override is a negative
      // entitlement (kind: revoke), not a deleted row — the resolver now
      // reads (plan ∪ grant) − revoke, so a disable must persist a revoke
      // row to keep suppressing plan-derived access.
      const kind = enabled ? 'grant' : 'revoke'
      // The entitlement must be scoped to the module's OWN product. Using a
      // fixed product id here wrote the override under the wrong product for
      // any non-Instagram module, so the resolver never saw it.
      const productId = await productIdOfModule(prisma, moduleId)
      await prisma.$transaction([
        prisma.tenantModuleOverride.upsert({
          where: { tenantId_moduleId: { tenantId, moduleId } },
          create: { tenantId, moduleId, enabled, createdBy: createdBy ?? null, reason: reason ?? null },
          update: { enabled, reason: reason ?? null },
        }),
        prisma.entitlement.upsert({
          where: {
            tenantId_productId_moduleId_source: {
              tenantId,
              productId,
              moduleId,
              source: 'override',
            },
          },
          create: {
            tenantId,
            productId,
            moduleId,
            source: 'override',
            kind,
            createdBy: createdBy ?? null,
            reason: reason ?? null,
          },
          update: { kind, createdBy: createdBy ?? null, reason: reason ?? null },
        }),
      ])
      return productId
    },

    async deleteTenantOverride(tenantId, moduleId) {
      const productId = await productIdOfModule(prisma, moduleId)
      await prisma.$transaction([
        prisma.tenantModuleOverride.delete({
          where: { tenantId_moduleId: { tenantId, moduleId } },
        }),
        prisma.entitlement.deleteMany({
          where: { tenantId, productId, moduleId, source: 'override' },
        }),
      ])
      return productId
    },

    async grantTrial(tenantId, productId, moduleId, expiresAt, createdBy, reason) {
      // ponytail: only the null-moduleId case needs the non-atomic
      // findFirst+create/update workaround — Prisma's compound-unique
      // upsert already handles the module-scoped case atomically.
      if (moduleId === null) {
        await prisma.$transaction(async (tx) => {
          const existing = await tx.entitlement.findFirst({
            where: { tenantId, productId, moduleId: null, source: 'trial' },
          })
          if (existing) {
            await tx.entitlement.update({
              where: { id: existing.id },
              data: { kind: 'grant', expiresAt, createdBy: createdBy ?? null, reason: reason ?? null },
            })
          } else {
            await tx.entitlement.create({
              data: { tenantId, productId, moduleId: null, source: 'trial', kind: 'grant', expiresAt, createdBy: createdBy ?? null, reason: reason ?? null },
            })
          }
        })
        return
      }

      // Granting a module of another product would make the resolver surface
      // it under this product — same coupling rule as setPlanModules.
      const moduleProductId = await productIdOfModule(prisma, moduleId)
      if (moduleProductId !== productId) {
        throw new ValidationError(
          'modules.product_mismatch',
          `Module '${moduleId}' belongs to product '${moduleProductId}', not '${productId}'`,
        )
      }

      const key = { tenantId, productId, moduleId, source: 'trial' as const }
      await prisma.entitlement.upsert({
        where: { tenantId_productId_moduleId_source: key },
        create: { ...key, kind: 'grant', expiresAt, createdBy: createdBy ?? null, reason: reason ?? null },
        update: { kind: 'grant', expiresAt, createdBy: createdBy ?? null, reason: reason ?? null },
      })
    },

    async sweepExpiredTrials() {
      const where = { source: 'trial' as const, kind: 'grant' as const, expiresAt: { lt: new Date() } }
      const expired = await prisma.entitlement.findMany({ where, select: { tenantId: true, productId: true } })
      if (expired.length === 0) return []

      await prisma.entitlement.deleteMany({ where })

      const seen = new Set<string>()
      const pairs: { tenantId: string; productId: string }[] = []
      for (const entitlement of expired) {
        const pairKey = `${entitlement.tenantId}:${entitlement.productId}`
        if (seen.has(pairKey)) continue
        seen.add(pairKey)
        pairs.push(entitlement)
      }
      return pairs
    },
  }
}

async function productIdOfModule(prisma: PrismaClient, moduleId: string): Promise<string> {
  const module = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { productId: true },
  })
  if (!module) throw new NotFoundError('modules.not_found', `Unknown module '${moduleId}'`)
  if (module.productId === null) {
    throw new ValidationError('modules.no_product', `Module '${moduleId}' is not attached to a product`)
  }
  return module.productId
}

function toProduct(row: { id: string; name: string; description: string | null }): AvailableProduct {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
  }
}

function toModule(row: { id: string; name: string; description: string | null; defaultUrl: string; active: boolean; productId?: string | null; parentId?: string | null }): Module {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    defaultUrl: row.defaultUrl,
    active: row.active,
    productId: row.productId ?? null,
    parentId: row.parentId ?? null,
  }
}
