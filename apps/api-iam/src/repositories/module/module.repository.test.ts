import { describe, it, expect, vi } from 'vitest'
import { createModuleRepository } from './module.repository.js'
import { DEFAULT_PRODUCT_ID } from '../../domain/index.js'

function makePrisma(overrides: Record<string, unknown> = {}) {
  const base = {
    tenantModuleOverride: {
      upsert: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    entitlement: {
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
      // PR7 (b1.5): the null-moduleId grant path uses findFirst+create/update
      // inside a transaction (Prisma's compound-unique upsert rejects null).
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    tenantProductSubscription: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    planModule: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    // PR7 (b1.5): resolver expands a product-scoped entitlement (moduleId:
    // null) to every module of the product via module.findMany.
    module: {
      findMany: vi.fn().mockResolvedValue([]),
      // Override writes resolve the module's own product for the Entitlement
      // scope — a module without a product is rejected.
      findUnique: vi.fn().mockResolvedValue({ productId: DEFAULT_PRODUCT_ID }),
    },
    plan: {
      findUnique: vi.fn().mockResolvedValue({ productId: DEFAULT_PRODUCT_ID }),
    },
    ...overrides,
  }
  return {
    ...base,
    // Supports both the array form (existing callers) and the interactive
    // callback form (PR7's null-moduleId grantTrial branch).
    $transaction: vi.fn().mockImplementation((arg: unknown) =>
      typeof arg === 'function' ? (arg as (tx: unknown) => Promise<unknown>)(base) : Promise.all(arg as Promise<unknown>[]),
    ),
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

// PR7 (b1.5, owner decision #1679/1): a product-scoped entitlement
// (moduleId: null) applies to every module of that product. Precedence:
// effective = (plan ∪ all grants [module + product-expanded]) − all revokes
// [module + product-expanded] — a revoke at EITHER scope always wins.
describe('ModuleRepository — resolveEffectiveModules — product-scoped entitlements (PR7/b1.5)', () => {
  const productModule = (id: string) => ({
    id,
    name: id,
    description: null,
    defaultUrl: `https://example.com/${id}`,
    active: true,
  })

  it('a product-level grant (moduleId: null) enables every module of that product', async () => {
    const prisma = makePrisma({
      module: { findMany: vi.fn().mockResolvedValue([productModule('mod-a'), productModule('mod-b')]) },
      entitlement: {
        upsert: vi.fn(),
        deleteMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn().mockResolvedValue([{ moduleId: null, kind: 'grant', source: 'trial', module: null }]),
      },
    })
    const repo = createModuleRepository(prisma as never)

    const result = await repo.resolveEffectiveModules('t1', 'p1')

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'mod-a', source: 'trial' }),
        expect.objectContaining({ id: 'mod-b', source: 'trial' }),
      ]),
    )
    expect(result).toHaveLength(2)
  })

  it('a module-level revoke still removes one module under a product-level grant (precedence)', async () => {
    const prisma = makePrisma({
      module: { findMany: vi.fn().mockResolvedValue([productModule('mod-a'), productModule('mod-b')]) },
      entitlement: {
        upsert: vi.fn(),
        deleteMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn().mockResolvedValue([
          { moduleId: null, kind: 'grant', source: 'trial', module: null },
          { moduleId: 'mod-a', kind: 'revoke', source: 'override', module: productModule('mod-a') },
        ]),
      },
    })
    const repo = createModuleRepository(prisma as never)

    const result = await repo.resolveEffectiveModules('t1', 'p1')

    expect(result).toEqual([expect.objectContaining({ id: 'mod-b', source: 'trial' })])
  })

  it('a product-level revoke (moduleId: null) removes every module of the product, including plan-granted ones', async () => {
    const prisma = makePrisma({
      tenantProductSubscription: {
        findUnique: vi.fn().mockResolvedValue({ tenantId: 't1', productId: 'p1', planId: 'plan-1' }),
      },
      planModule: {
        findMany: vi.fn().mockResolvedValue([{ planId: 'plan-1', moduleId: 'mod-a', module: productModule('mod-a') }]),
      },
      module: { findMany: vi.fn().mockResolvedValue([productModule('mod-a'), productModule('mod-b')]) },
      entitlement: {
        upsert: vi.fn(),
        deleteMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn().mockResolvedValue([
          { moduleId: 'mod-b', kind: 'grant', source: 'admin', module: productModule('mod-b') },
          { moduleId: null, kind: 'revoke', source: 'admin', module: null },
        ]),
      },
    })
    const repo = createModuleRepository(prisma as never)

    const result = await repo.resolveEffectiveModules('t1', 'p1')

    expect(result).toEqual([])
  })

  // No regression: module-level-only tenants never trigger the
  // product-expansion query.
  it('does not query the product module list when no product-scoped entitlement exists', async () => {
    const moduleFindMany = vi.fn().mockResolvedValue([])
    const prisma = makePrisma({ module: { findMany: moduleFindMany } })
    const repo = createModuleRepository(prisma as never)

    await repo.resolveEffectiveModules('t1', 'p1')

    expect(moduleFindMany).not.toHaveBeenCalled()
  })
})

// PR7 (b1.5, owner decision #1679/1): grantTrial must accept moduleId: null
// (product-level trial). Prisma's compound-unique upsert can't express a
// null member, so the null case uses findFirst+create/update inside a
// $transaction; the module-scoped case keeps the existing compound upsert.
describe('ModuleRepository — grantTrial — product-scoped grant (moduleId: null) (PR7/b1.5)', () => {
  it('creates a moduleId: null trial entitlement via findFirst+create in a transaction when none exists', async () => {
    const prisma = makePrisma()
    const repo = createModuleRepository(prisma as never)
    const expiresAt = new Date('2026-08-15T00:00:00.000Z')

    await repo.grantTrial('tenant-1', 'instagram-dashboard', null, expiresAt, 'admin-1', 'evaluation')

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(prisma.entitlement.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', productId: 'instagram-dashboard', moduleId: null, source: 'trial' },
    })
    expect(prisma.entitlement.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        productId: 'instagram-dashboard',
        moduleId: null,
        source: 'trial',
        kind: 'grant',
        expiresAt,
        createdBy: 'admin-1',
        reason: 'evaluation',
      },
    })
    expect(prisma.entitlement.update).not.toHaveBeenCalled()
    expect(prisma.entitlement.upsert).not.toHaveBeenCalled()
  })

  it('renews an existing moduleId: null trial entitlement via update instead of creating a duplicate', async () => {
    const prisma = makePrisma({
      entitlement: {
        upsert: vi.fn(),
        deleteMany: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({ id: 'ent-1' }),
        create: vi.fn(),
        update: vi.fn(),
      },
    })
    const repo = createModuleRepository(prisma as never)
    const expiresAt = new Date('2026-08-15T00:00:00.000Z')

    await repo.grantTrial('tenant-1', 'instagram-dashboard', null, expiresAt)

    expect(prisma.entitlement.update).toHaveBeenCalledWith({
      where: { id: 'ent-1' },
      data: { kind: 'grant', expiresAt, createdBy: null, reason: null },
    })
    expect(prisma.entitlement.create).not.toHaveBeenCalled()
  })

  it('still uses the compound upsert for a module-scoped grant (no regression)', async () => {
    const prisma = makePrisma()
    const repo = createModuleRepository(prisma as never)
    const expiresAt = new Date('2026-08-15T00:00:00.000Z')

    await repo.grantTrial('tenant-1', 'instagram-dashboard', 'mod-a', expiresAt)

    expect(prisma.entitlement.upsert).toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})

// A module belongs to exactly one product and is not attachable to plans of a
// different product (e.g. the ig-* modules only belong to instagram-dashboard).
// setPlanModules is the only write path into plan_modules, so it is the gate.
describe('ModuleRepository — setPlanModules product coupling', () => {
  it('rejects modules that belong to another product', async () => {
    const prisma = makePrisma({
      plan: { findUnique: vi.fn().mockResolvedValue({ productId: 'instagram-dashboard' }) },
      module: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'ig-basic-metrics', productId: 'instagram-dashboard' },
          { id: 'crm-contacts', productId: 'crm' },
        ]),
        findUnique: vi.fn(),
      },
    })
    const repo = createModuleRepository(prisma as never)

    await expect(
      repo.setPlanModules('starter', ['ig-basic-metrics', 'crm-contacts']),
    ).rejects.toMatchObject({ code: 'modules.product_mismatch' })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects a module with no product at all', async () => {
    const prisma = makePrisma({
      plan: { findUnique: vi.fn().mockResolvedValue({ productId: 'instagram-dashboard' }) },
      module: {
        findMany: vi.fn().mockResolvedValue([{ id: 'orphan', productId: null }]),
        findUnique: vi.fn(),
      },
    })
    const repo = createModuleRepository(prisma as never)

    await expect(repo.setPlanModules('starter', ['orphan'])).rejects.toMatchObject({
      code: 'modules.product_mismatch',
    })
  })

  it('writes the assignment when every module shares the plan product', async () => {
    const prisma = makePrisma({
      plan: { findUnique: vi.fn().mockResolvedValue({ productId: 'instagram-dashboard' }) },
      module: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'ig-basic-metrics', productId: 'instagram-dashboard' },
          { id: 'ig-publications', productId: 'instagram-dashboard' },
        ]),
        findUnique: vi.fn(),
      },
      planModule: { findMany: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
    })
    const repo = createModuleRepository(prisma as never)

    await repo.setPlanModules('starter', ['ig-basic-metrics', 'ig-publications'])

    expect(prisma.$transaction).toHaveBeenCalled()
  })
})
