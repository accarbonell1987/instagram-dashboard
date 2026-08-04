import type { Logger } from 'pino'
import type { ModuleRepository } from '../repositories/module/index.js'
import type { TenantRepository } from '../repositories/tenant/index.js'
import type { AvailableProductWithModules, EffectiveModule, Module } from '../domain/index.js'
import { DEFAULT_PRODUCT_ID, DEFAULT_TRIAL_DURATION_DAYS } from '../domain/index.js'
import { NotFoundError } from '../errors.js'

export type ModuleServiceDeps = {
  moduleRepository: ModuleRepository
  tenantRepository: TenantRepository
  logger: Logger
}

export type ModuleService = {
  getEffectiveModulesForTenant(tenantUuid: string, userId?: string): Promise<EffectiveModule[]>
  // a3 (3.2): arbitrary-product variant backing the internal entitlements
  // endpoint the future entitlement middleware calls.
  getEffectiveModulesForTenantAndProduct(tenantUuid: string, productId: string, userId?: string): Promise<EffectiveModule[]>
  // Portal landing: the products the tenant can reach, each carrying its
  // effective modules. `allProducts` is the SuperAdmin view.
  getAvailableProductsForTenant(
    tenantUuid: string,
    userId?: string,
    allProducts?: boolean,
  ): Promise<AvailableProductWithModules[]>
  listAll(productId?: string): Promise<Module[]>
  getById(id: string): Promise<Module>
  create(data: { id: string; name: string; description?: string; defaultUrl: string; productId: string; parentId?: string }): Promise<Module>
  update(id: string, data: Partial<{ name: string; description: string; defaultUrl: string; active: boolean }>): Promise<Module>
  remove(id: string): Promise<void>
  setPlanModules(planId: string, moduleIds: string[]): Promise<void>
  listPlanModules(planId: string): Promise<{ moduleId: string }[]>
  // Both return the module's productId — callers purge that product's cache.
  upsertTenantOverride(tenantId: string, moduleId: string, enabled: boolean, createdBy?: string, reason?: string): Promise<string>
  removeTenantOverride(tenantId: string, moduleId: string): Promise<string>
  // b1 (5.1) + b1.5 (PR7, owner decision #1679/1): admin trial grant —
  // durationDays defaults to DEFAULT_TRIAL_DURATION_DAYS (14,
  // owner-confirmed #1677). moduleId: null means a product-scoped grant
  // (see ModuleRepository.grantTrial — resolveEffectiveModules expands it to
  // every module of the product).
  grantTrial(
    tenantId: string,
    productId: string,
    moduleId: string | null,
    durationDays: number | undefined,
    createdBy?: string,
    reason?: string,
  ): Promise<{ tenantId: string; productId: string; moduleId: string | null; expiresAt: Date }>
  // b1 (5.2): cron sweep of expired trials — returns affected (tenant,
  // product) pairs for the caller to fan out a cache purge.
  sweepExpiredTrials(): Promise<{ tenantId: string; productId: string }[]>
}

export function createModuleService(deps: ModuleServiceDeps): ModuleService {
  const { moduleRepository, tenantRepository, logger } = deps
  const log = logger.child({ component: 'module-service' })

  return {
    async getEffectiveModulesForTenant(tenantUuid, userId) {
      log.debug({ tenantUuid }, 'resolving effective modules')
      // a3: switched from the legacy findEffectiveForTenant(planId, tenantId)
      // join to the union-minus-revoke resolver. findByUuid is kept as the
      // 404 guard for an unknown tenant; findEffectiveForTenant stays
      // available in the repository as the one-release rollback lever.
      await tenantRepository.findByUuid(tenantUuid)
      return moduleRepository.resolveEffectiveModules(tenantUuid, DEFAULT_PRODUCT_ID, userId)
    },

    async getEffectiveModulesForTenantAndProduct(tenantUuid, productId, userId) {
      log.debug({ tenantUuid, productId }, 'resolving effective modules for product')
      return moduleRepository.resolveEffectiveModules(tenantUuid, productId, userId)
    },

    async getAvailableProductsForTenant(tenantUuid, userId, allProducts = false) {
      const products = allProducts
        ? await moduleRepository.findAllActiveProducts()
        : await moduleRepository.findAvailableProducts(tenantUuid)

      const withModules = await Promise.all(
        products.map(async (product) => ({
          ...product,
          // SuperAdmin sees every active module of the product — its own tenant
          // has no subscription to resolve against.
          modules: allProducts
            ? (await moduleRepository.findAll(product.id))
                .filter((module) => module.active)
                .map((module) => ({
                  ...module,
                  effectiveUrl: module.defaultUrl,
                  source: 'admin' as const,
                }))
            : await moduleRepository.resolveEffectiveModules(tenantUuid, product.id, userId),
        })),
      )

      // A product with no reachable module is a dead card in the portal —
      // the subscription exists but the plan grants nothing the user can open.
      const visible = withModules.filter((product) => product.modules.length > 0)
      log.debug({ tenantUuid, count: visible.length }, 'resolved available products')
      return visible
    },

    async listAll(productId) {
      return moduleRepository.findAll(productId)
    },

    async getById(id) {
      const module = await moduleRepository.findById(id)
      if (!module) throw new NotFoundError(`Module '${id}' not found`)
      return module
    },

    async create(data) {
      log.info({ id: data.id, productId: data.productId }, 'creating module')
      return moduleRepository.create(data)
    },

    async update(id, data) {
      const module = await moduleRepository.findById(id)
      if (!module) throw new NotFoundError(`Module '${id}' not found`)
      log.info({ id }, 'updating module')
      return moduleRepository.update(id, data)
    },

    async remove(id) {
      const module = await moduleRepository.findById(id)
      if (!module) throw new NotFoundError(`Module '${id}' not found`)
      log.info({ id }, 'deleting module')
      return moduleRepository.delete(id)
    },

    async setPlanModules(planId, moduleIds) {
      log.info({ planId, count: moduleIds.length }, 'setting plan modules')
      return moduleRepository.setPlanModules(planId, moduleIds)
    },

    async listPlanModules(planId) {
      return moduleRepository.findPlanModules(planId)
    },

    async upsertTenantOverride(tenantId, moduleId, enabled, createdBy, reason) {
      log.info({ tenantId, moduleId, enabled }, 'upserting tenant module override')
      return moduleRepository.upsertTenantOverride(tenantId, moduleId, enabled, createdBy, reason)
    },

    async removeTenantOverride(tenantId, moduleId) {
      log.info({ tenantId, moduleId }, 'removing tenant module override')
      return moduleRepository.deleteTenantOverride(tenantId, moduleId)
    },

    async grantTrial(tenantId, productId, moduleId, durationDays, createdBy, reason) {
      await tenantRepository.findByUuid(tenantId)
      const days = durationDays ?? DEFAULT_TRIAL_DURATION_DAYS
      const expiresAt = new Date()
      expiresAt.setUTCDate(expiresAt.getUTCDate() + days)
      log.info({ tenantId, productId, moduleId, expiresAt }, 'granting trial')
      await moduleRepository.grantTrial(tenantId, productId, moduleId, expiresAt, createdBy, reason)
      return { tenantId, productId, moduleId, expiresAt }
    },

    async sweepExpiredTrials() {
      log.debug({}, 'sweeping expired trials')
      return moduleRepository.sweepExpiredTrials()
    },
  }
}
