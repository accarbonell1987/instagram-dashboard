import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createModuleService } from './module.service.js'
import type { ModuleServiceDeps } from './module.service.js'
import { DEFAULT_PRODUCT_ID, DEFAULT_TRIAL_DURATION_DAYS } from '../domain/index.js'
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
      findAvailableProducts: vi.fn().mockResolvedValue([]),
      findAllActiveProducts: vi.fn().mockResolvedValue([]),
      resolveEffectiveModules: vi.fn().mockResolvedValue([effectiveModule]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      setPlanModules: vi.fn(),
      findPlanModules: vi.fn().mockResolvedValue([]),
      upsertTenantOverride: vi.fn(),
      deleteTenantOverride: vi.fn(),
      grantTrial: vi.fn(),
      sweepExpiredTrials: vi.fn().mockResolvedValue([]),
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

// b1 (5.1): grant flow — 404 guard on unknown tenant (mirrors
// getEffectiveModulesForTenant), default duration, and admin override.
describe('ModuleService — grantTrial (b1, 5.1)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('defaults expiresAt to now + 14 days when no duration override is given', async () => {
    const deps = makeDeps()
    const service = createModuleService(deps)

    const result = await service.grantTrial('tenant-uuid-1', DEFAULT_PRODUCT_ID, 'mod-a', undefined, 'admin-1', 'eval')

    const expectedExpiresAt = new Date('2026-08-01T00:00:00.000Z')
    expectedExpiresAt.setUTCDate(expectedExpiresAt.getUTCDate() + DEFAULT_TRIAL_DURATION_DAYS)
    expect(deps.moduleRepository.grantTrial).toHaveBeenCalledWith(
      'tenant-uuid-1',
      DEFAULT_PRODUCT_ID,
      'mod-a',
      expectedExpiresAt,
      'admin-1',
      'eval',
    )
    expect(result.expiresAt).toEqual(expectedExpiresAt)
  })

  it('honors an admin-provided duration override', async () => {
    const deps = makeDeps()
    const service = createModuleService(deps)

    await service.grantTrial('tenant-uuid-1', DEFAULT_PRODUCT_ID, 'mod-a', 30)

    const expectedExpiresAt = new Date('2026-08-01T00:00:00.000Z')
    expectedExpiresAt.setUTCDate(expectedExpiresAt.getUTCDate() + 30)
    expect(deps.moduleRepository.grantTrial).toHaveBeenCalledWith(
      'tenant-uuid-1',
      DEFAULT_PRODUCT_ID,
      'mod-a',
      expectedExpiresAt,
      undefined,
      undefined,
    )
  })

  // PR7 (b1.5, owner decision #1679/1): moduleId: null (product-scoped grant)
  // passes through to the repository unchanged.
  it('forwards a null moduleId (product-scoped grant) to the repository unchanged', async () => {
    const deps = makeDeps()
    const service = createModuleService(deps)

    const result = await service.grantTrial('tenant-uuid-1', DEFAULT_PRODUCT_ID, null, undefined, 'admin-1')

    expect(deps.moduleRepository.grantTrial).toHaveBeenCalledWith(
      'tenant-uuid-1',
      DEFAULT_PRODUCT_ID,
      null,
      expect.any(Date),
      'admin-1',
      undefined,
    )
    expect(result.moduleId).toBeNull()
  })

  it('throws NotFoundError (via tenantRepository.findByUuid) for an unknown tenant', async () => {
    const deps = makeDeps({
      tenantRepository: {
        findBySlug: vi.fn(),
        findByUuid: vi.fn().mockRejectedValue(new Error('tenant.not_found')),
        create: vi.fn(),
        updateStatus: vi.fn(),
        updateName: vi.fn(),
        findAllPaginated: vi.fn(),
        findByIdWithDetail: vi.fn(),
      },
    })
    const service = createModuleService(deps)

    await expect(service.grantTrial('missing', DEFAULT_PRODUCT_ID, 'mod-a', undefined)).rejects.toThrow('tenant.not_found')
    expect(deps.moduleRepository.grantTrial).not.toHaveBeenCalled()
  })
})

describe('ModuleService — sweepExpiredTrials (b1, 5.2)', () => {
  it('delegates to moduleRepository.sweepExpiredTrials', async () => {
    const pairs = [{ tenantId: 't1', productId: DEFAULT_PRODUCT_ID }]
    const deps = makeDeps({
      moduleRepository: {
        findAll: vi.fn(),
        findById: vi.fn(),
        findEffectiveForTenant: vi.fn(),
        findAvailableProducts: vi.fn().mockResolvedValue([]),
        findAllActiveProducts: vi.fn().mockResolvedValue([]),
        resolveEffectiveModules: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        setPlanModules: vi.fn(),
        findPlanModules: vi.fn().mockResolvedValue([]),
        upsertTenantOverride: vi.fn(),
        deleteTenantOverride: vi.fn(),
        grantTrial: vi.fn(),
        sweepExpiredTrials: vi.fn().mockResolvedValue(pairs),
      },
    })
    const service = createModuleService(deps)

    const result = await service.sweepExpiredTrials()

    expect(result).toEqual(pairs)
  })
})
