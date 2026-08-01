import { describe, it, expect, vi } from 'vitest'
import { createModuleRepository } from './module.repository.js'
import { DEFAULT_PRODUCT_ID } from '../../domain/index.js'

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    tenantModuleOverride: {
      upsert: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    entitlement: {
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    tenantProductSubscription: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    planModule: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
    ...overrides,
  }
}

// a2 (2.2): admin write paths for TenantModuleOverride must stay in sync with
// the new Entitlement(source: override) model — see design "admin write
// paths additionally upsert the corresponding Entitlement row".
//
// a3 (owner-confirmed #1675): a disabling override is now a negative
// entitlement (kind: revoke), not a deleted row — the resolver reads
// (plan ∪ grant) − revoke, so a stale/missing Entitlement row would let a
// disabled override silently stop suppressing plan-derived access.
describe('ModuleRepository — Entitlement sync (a2 + a3 revoke)', () => {
  it('upsertTenantOverride(enabled: true) upserts a grant Entitlement(source: override) row', async () => {
    const prisma = makePrisma()
    const repo = createModuleRepository(prisma as never)

    await repo.upsertTenantOverride('tenant-1', 'module-1', true, 'admin-1', 'granted manually')

    expect(prisma.entitlement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_productId_moduleId_source: {
            tenantId: 'tenant-1',
            productId: DEFAULT_PRODUCT_ID,
            moduleId: 'module-1',
            source: 'override',
          },
        },
        create: expect.objectContaining({ kind: 'grant' }),
        update: expect.objectContaining({ kind: 'grant' }),
      }),
    )
    expect(prisma.entitlement.deleteMany).not.toHaveBeenCalled()
  })

  it('upsertTenantOverride(enabled: false) upserts a revoke Entitlement(source: override) row instead of deleting it', async () => {
    const prisma = makePrisma()
    const repo = createModuleRepository(prisma as never)

    await repo.upsertTenantOverride('tenant-1', 'module-1', false)

    expect(prisma.entitlement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_productId_moduleId_source: {
            tenantId: 'tenant-1',
            productId: DEFAULT_PRODUCT_ID,
            moduleId: 'module-1',
            source: 'override',
          },
        },
        create: expect.objectContaining({ kind: 'revoke' }),
        update: expect.objectContaining({ kind: 'revoke' }),
      }),
    )
    expect(prisma.entitlement.deleteMany).not.toHaveBeenCalled()
  })

  it('deleteTenantOverride removes the corresponding Entitlement row entirely', async () => {
    const prisma = makePrisma()
    const repo = createModuleRepository(prisma as never)

    await repo.deleteTenantOverride('tenant-1', 'module-1')

    expect(prisma.tenantModuleOverride.delete).toHaveBeenCalledWith({
      where: { tenantId_moduleId: { tenantId: 'tenant-1', moduleId: 'module-1' } },
    })
    expect(prisma.entitlement.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', productId: DEFAULT_PRODUCT_ID, moduleId: 'module-1', source: 'override' },
    })
  })
})

// a3 (3.1 + 3.4): resolver switch — effective modules = (plan live-join ∪
// grant entitlements) − revoke entitlements, scoped per product.
describe('ModuleRepository — resolveEffectiveModules (a3)', () => {
  const activeModule = (id: string) => ({
    id,
    name: id,
    description: null,
    defaultUrl: `https://example.com/${id}`,
    active: true,
  })

  it('includes plan-derived modules with source "plan"', async () => {
    const prisma = makePrisma({
      tenantProductSubscription: {
        findUnique: vi.fn().mockResolvedValue({ tenantId: 't1', productId: 'p1', planId: 'plan-1' }),
      },
      planModule: {
        findMany: vi.fn().mockResolvedValue([{ planId: 'plan-1', moduleId: 'mod-a', module: activeModule('mod-a') }]),
      },
    })
    const repo = createModuleRepository(prisma as never)

    const result = await repo.resolveEffectiveModules('t1', 'p1')

    expect(result).toEqual([expect.objectContaining({ id: 'mod-a', source: 'plan' })])
  })

  it('a grant entitlement adds a module the plan does not grant', async () => {
    const prisma = makePrisma({
      entitlement: {
        upsert: vi.fn(),
        deleteMany: vi.fn(),
        findMany: vi.fn().mockResolvedValue([
          { moduleId: 'mod-b', kind: 'grant', source: 'trial', module: activeModule('mod-b') },
        ]),
      },
    })
    const repo = createModuleRepository(prisma as never)

    const result = await repo.resolveEffectiveModules('t1', 'p1')

    expect(result).toEqual([expect.objectContaining({ id: 'mod-b', source: 'trial' })])
  })

  // The key negative-override scenario (owner-confirmed #1675): a revoke
  // entitlement must remove a module that the tenant's plan otherwise grants.
  it('a revoke entitlement removes a plan-granted module', async () => {
    const prisma = makePrisma({
      tenantProductSubscription: {
        findUnique: vi.fn().mockResolvedValue({ tenantId: 't1', productId: 'p1', planId: 'plan-1' }),
      },
      planModule: {
        findMany: vi.fn().mockResolvedValue([{ planId: 'plan-1', moduleId: 'mod-a', module: activeModule('mod-a') }]),
      },
      entitlement: {
        upsert: vi.fn(),
        deleteMany: vi.fn(),
        findMany: vi.fn().mockResolvedValue([
          { moduleId: 'mod-a', kind: 'revoke', source: 'override', module: activeModule('mod-a') },
        ]),
      },
    })
    const repo = createModuleRepository(prisma as never)

    const result = await repo.resolveEffectiveModules('t1', 'p1')

    expect(result).toEqual([])
  })

  // Spec scenario: "Module scoped to its product only" — an Entitlement is
  // always queried with the requested productId, so a grant for another
  // product never leaks in.
  it('scopes the entitlement query to the requested product', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const prisma = makePrisma({ entitlement: { upsert: vi.fn(), deleteMany: vi.fn(), findMany } })
    const repo = createModuleRepository(prisma as never)

    await repo.resolveEffectiveModules('t1', 'product-b')

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 't1', productId: 'product-b' }) }),
    )
  })
})

// b1 (5.1/5.3): trial grants are Entitlement(source: trial, kind: grant,
// expiresAt) rows, upserted on the same [tenantId, productId, moduleId,
// source] unique key the override sync already uses (a re-grant renews the
// expiry instead of erroring on a duplicate row).
describe('ModuleRepository — grantTrial (b1, 5.1)', () => {
  it('upserts a grant Entitlement(source: trial) row with the given expiresAt', async () => {
    const prisma = makePrisma()
    const repo = createModuleRepository(prisma as never)
    const expiresAt = new Date('2026-08-15T00:00:00.000Z')

    await repo.grantTrial('tenant-1', 'instagram-dashboard', 'mod-a', expiresAt, 'admin-1', 'evaluation')

    expect(prisma.entitlement.upsert).toHaveBeenCalledWith({
      where: {
        tenantId_productId_moduleId_source: {
          tenantId: 'tenant-1',
          productId: 'instagram-dashboard',
          moduleId: 'mod-a',
          source: 'trial',
        },
      },
      create: {
        tenantId: 'tenant-1',
        productId: 'instagram-dashboard',
        moduleId: 'mod-a',
        source: 'trial',
        kind: 'grant',
        expiresAt,
        createdBy: 'admin-1',
        reason: 'evaluation',
      },
      update: { kind: 'grant', expiresAt, createdBy: 'admin-1', reason: 'evaluation' },
    })
  })
})

// b1 (5.2/5.3): the resolver (resolveEffectiveModules) already excludes
// entitlements with expiresAt in the past at request time — see the
// `OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]` filter above, so
// access is already denied the moment a trial expires. The sweep's job is
// hygiene (delete stale rows) + returning the affected (tenant, product)
// pairs so the caller can fan out a cache purge (packages/entitlements'
// 60s TTL would otherwise keep serving a stale allow for up to a minute).
describe('ModuleRepository — sweepExpiredTrials (b1, 5.2)', () => {
  it('deletes expired grant trial entitlements and returns affected tenant/product pairs', async () => {
    const prisma = makePrisma({
      entitlement: {
        upsert: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
        findMany: vi.fn().mockResolvedValue([
          { tenantId: 't1', productId: 'instagram-dashboard' },
          { tenantId: 't1', productId: 'instagram-dashboard' },
        ]),
      },
    })
    const repo = createModuleRepository(prisma as never)

    const result = await repo.sweepExpiredTrials()

    expect(prisma.entitlement.findMany).toHaveBeenCalledWith({
      where: { source: 'trial', kind: 'grant', expiresAt: { lt: expect.any(Date) } },
      select: { tenantId: true, productId: true },
    })
    expect(prisma.entitlement.deleteMany).toHaveBeenCalledWith({
      where: { source: 'trial', kind: 'grant', expiresAt: { lt: expect.any(Date) } },
    })
    // deduped — both expired rows belong to the same (tenant, product) pair
    expect(result).toEqual([{ tenantId: 't1', productId: 'instagram-dashboard' }])
  })

  it('does not call deleteMany when nothing is expired', async () => {
    const prisma = makePrisma({
      entitlement: { upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    })
    const repo = createModuleRepository(prisma as never)

    const result = await repo.sweepExpiredTrials()

    expect(prisma.entitlement.deleteMany).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })
})
