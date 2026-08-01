import type { PrismaClient } from '../../generated/prisma/client.js'
import type { Module, EffectiveModule } from '../../domain/index.js'
import { DEFAULT_PRODUCT_ID } from '../../domain/index.js'

export type ModuleRepository = {
  findAll(): Promise<Module[]>
  findById(id: string): Promise<Module | null>
  // Legacy resolver (pre-a3). Kept available for one release per the design
  // rollout notes — rollback lever if the a3 switch needs to be reverted.
  findEffectiveForTenant(planId: string, tenantId: string): Promise<EffectiveModule[]>
  // a3: effective modules = (plan live-join ∪ grant Entitlements) − revoke
  // Entitlements, scoped to (tenantId, productId).
  resolveEffectiveModules(tenantId: string, productId: string): Promise<EffectiveModule[]>
  create(data: { id: string; name: string; description?: string; defaultUrl: string }): Promise<Module>
  update(id: string, data: Partial<{ name: string; description: string; defaultUrl: string; active: boolean }>): Promise<Module>
  delete(id: string): Promise<void>
  setPlanModules(planId: string, moduleIds: string[]): Promise<void>
  upsertTenantOverride(tenantId: string, moduleId: string, enabled: boolean, createdBy?: string, reason?: string): Promise<void>
  deleteTenantOverride(tenantId: string, moduleId: string): Promise<void>
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
    async findAll() {
      const rows = await prisma.module.findMany({ orderBy: { id: 'asc' } })
      return rows.map(toModule)
    },

    async findById(id) {
      const row = await prisma.module.findUnique({ where: { id } })
      return row ? toModule(row) : null
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

    async resolveEffectiveModules(tenantId, productId) {
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

      return Array.from(result.values())
    },

    async create(data) {
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
      await prisma.$transaction([
        prisma.planModule.deleteMany({ where: { planId } }),
        prisma.planModule.createMany({
          data: moduleIds.map(moduleId => ({ planId, moduleId })),
        }),
      ])
    },

    async upsertTenantOverride(tenantId, moduleId, enabled, createdBy, reason) {
      // a3 (owner-confirmed #1675): a disabled override is a negative
      // entitlement (kind: revoke), not a deleted row — the resolver now
      // reads (plan ∪ grant) − revoke, so a disable must persist a revoke
      // row to keep suppressing plan-derived access.
      const kind = enabled ? 'grant' : 'revoke'
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
              productId: DEFAULT_PRODUCT_ID,
              moduleId,
              source: 'override',
            },
          },
          create: {
            tenantId,
            productId: DEFAULT_PRODUCT_ID,
            moduleId,
            source: 'override',
            kind,
            createdBy: createdBy ?? null,
            reason: reason ?? null,
          },
          update: { kind, createdBy: createdBy ?? null, reason: reason ?? null },
        }),
      ])
    },

    async deleteTenantOverride(tenantId, moduleId) {
      await prisma.$transaction([
        prisma.tenantModuleOverride.delete({
          where: { tenantId_moduleId: { tenantId, moduleId } },
        }),
        prisma.entitlement.deleteMany({
          where: { tenantId, productId: DEFAULT_PRODUCT_ID, moduleId, source: 'override' },
        }),
      ])
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

function toModule(row: { id: string; name: string; description: string | null; defaultUrl: string; active: boolean }): Module {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    defaultUrl: row.defaultUrl,
    active: row.active,
  }
}
