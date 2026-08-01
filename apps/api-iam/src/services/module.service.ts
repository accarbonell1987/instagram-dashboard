import type { Logger } from 'pino'
import type { ModuleRepository } from '../repositories/module/index.js'
import type { TenantRepository } from '../repositories/tenant/index.js'
import type { EffectiveModule, Module } from '../domain/index.js'
import { DEFAULT_PRODUCT_ID } from '../domain/index.js'
import { NotFoundError } from '../errors.js'

export type ModuleServiceDeps = {
  moduleRepository: ModuleRepository
  tenantRepository: TenantRepository
  logger: Logger
}

export type ModuleService = {
  getEffectiveModulesForTenant(tenantUuid: string): Promise<EffectiveModule[]>
  // a3 (3.2): arbitrary-product variant backing the internal entitlements
  // endpoint the future entitlement middleware calls.
  getEffectiveModulesForTenantAndProduct(tenantUuid: string, productId: string): Promise<EffectiveModule[]>
  listAll(): Promise<Module[]>
  getById(id: string): Promise<Module>
  create(data: { id: string; name: string; description?: string; defaultUrl: string }): Promise<Module>
  update(id: string, data: Partial<{ name: string; description: string; defaultUrl: string; active: boolean }>): Promise<Module>
  remove(id: string): Promise<void>
  setPlanModules(planId: string, moduleIds: string[]): Promise<void>
  upsertTenantOverride(tenantId: string, moduleId: string, enabled: boolean, createdBy?: string, reason?: string): Promise<void>
  removeTenantOverride(tenantId: string, moduleId: string): Promise<void>
}

export function createModuleService(deps: ModuleServiceDeps): ModuleService {
  const { moduleRepository, tenantRepository, logger } = deps
  const log = logger.child({ component: 'module-service' })

  return {
    async getEffectiveModulesForTenant(tenantUuid) {
      log.debug({ tenantUuid }, 'resolving effective modules')
      // a3: switched from the legacy findEffectiveForTenant(planId, tenantId)
      // join to the union-minus-revoke resolver. findByUuid is kept as the
      // 404 guard for an unknown tenant; findEffectiveForTenant stays
      // available in the repository as the one-release rollback lever.
      await tenantRepository.findByUuid(tenantUuid)
      return moduleRepository.resolveEffectiveModules(tenantUuid, DEFAULT_PRODUCT_ID)
    },

    async getEffectiveModulesForTenantAndProduct(tenantUuid, productId) {
      log.debug({ tenantUuid, productId }, 'resolving effective modules for product')
      return moduleRepository.resolveEffectiveModules(tenantUuid, productId)
    },

    async listAll() {
      return moduleRepository.findAll()
    },

    async getById(id) {
      const module = await moduleRepository.findById(id)
      if (!module) throw new NotFoundError(`Module '${id}' not found`)
      return module
    },

    async create(data) {
      log.info({ id: data.id }, 'creating module')
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

    async upsertTenantOverride(tenantId, moduleId, enabled, createdBy, reason) {
      log.info({ tenantId, moduleId, enabled }, 'upserting tenant module override')
      return moduleRepository.upsertTenantOverride(tenantId, moduleId, enabled, createdBy, reason)
    },

    async removeTenantOverride(tenantId, moduleId) {
      log.info({ tenantId, moduleId }, 'removing tenant module override')
      return moduleRepository.deleteTenantOverride(tenantId, moduleId)
    },
  }
}
