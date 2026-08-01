import { describe, it, expect, vi } from 'vitest'
import { createModuleService } from './module.service.js'
import type { ModuleServiceDeps } from './module.service.js'
import { DEFAULT_PRODUCT_ID } from '../domain/index.js'
import { silentLogger } from '../test-helpers/logger.js'

const effectiveModule = {
  id: 'mod-a',
  name: 'Module A',
  description: undefined,
  defaultUrl: 'https://example.com/mod-a',
  active: true,
  effectiveUrl: 'https://example.com/mod-a',
  source: 'plan' as const,
}

function makeDeps(overrides: Partial<ModuleServiceDeps> = {}): ModuleServiceDeps {
  return {
    moduleRepository: {
      findAll: vi.fn(),
      findById: vi.fn(),
      findEffectiveForTenant: vi.fn(),
      resolveEffectiveModules: vi.fn().mockResolvedValue([effectiveModule]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      setPlanModules: vi.fn(),
      upsertTenantOverride: vi.fn(),
      deleteTenantOverride: vi.fn(),
    },
    tenantRepository: {
      findBySlug: vi.fn(),
      findByUuid: vi.fn().mockResolvedValue({ id: 'tenant-uuid-1' }),
      create: vi.fn(),
      updateStatus: vi.fn(),
      updateName: vi.fn(),
      findAllPaginated: vi.fn(),
      findByIdWithDetail: vi.fn(),
    },
    logger: silentLogger,
    ...overrides,
  } as unknown as ModuleServiceDeps
}

// a3 (3.1): the public getEffectiveModulesForTenant switches from the legacy
// findEffectiveForTenant(planId, tenantId) resolver to the union-minus-revoke
// resolveEffectiveModules(tenantId, productId), scoped to the bootstrap
// product until multi-product declaration (phase e) exists.
describe('ModuleService — getEffectiveModulesForTenant (a3 resolver switch)', () => {
  it('calls resolveEffectiveModules with the tenant uuid and DEFAULT_PRODUCT_ID', async () => {
    const deps = makeDeps()
    const service = createModuleService(deps)

    const result = await service.getEffectiveModulesForTenant('tenant-uuid-1')

    expect(deps.moduleRepository.resolveEffectiveModules).toHaveBeenCalledWith('tenant-uuid-1', DEFAULT_PRODUCT_ID)
    expect(result).toEqual([effectiveModule])
  })

  it('no longer calls the legacy findEffectiveForTenant resolver', async () => {
    const deps = makeDeps()
    const service = createModuleService(deps)

    await service.getEffectiveModulesForTenant('tenant-uuid-1')

    expect(deps.moduleRepository.findEffectiveForTenant).not.toHaveBeenCalled()
  })
})

describe('ModuleService — getEffectiveModulesForTenantAndProduct (internal endpoints)', () => {
  it('resolves effective modules for an arbitrary productId', async () => {
    const deps = makeDeps()
    const service = createModuleService(deps)

    const result = await service.getEffectiveModulesForTenantAndProduct('tenant-uuid-1', 'other-product')

    expect(deps.moduleRepository.resolveEffectiveModules).toHaveBeenCalledWith('tenant-uuid-1', 'other-product')
    expect(result).toEqual([effectiveModule])
  })
})
