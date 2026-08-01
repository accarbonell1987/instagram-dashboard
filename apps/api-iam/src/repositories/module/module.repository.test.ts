import { describe, it, expect, vi } from 'vitest'
import { createModuleRepository } from './module.repository.js'
import { DEFAULT_PRODUCT_ID } from '../../domain/index.js'

function makePrisma() {
  return {
    tenantModuleOverride: {
      upsert: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    entitlement: {
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: vi.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
  }
}

// a2 (2.2): admin write paths for TenantModuleOverride must stay in sync with
// the new Entitlement(source: override) model — see design "admin write
// paths additionally upsert the corresponding Entitlement row".
describe('ModuleRepository — Entitlement sync (a2)', () => {
  it('upsertTenantOverride(enabled: true) also upserts an Entitlement(source: override) row', async () => {
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
      }),
    )
    expect(prisma.entitlement.deleteMany).not.toHaveBeenCalled()
  })

  it('upsertTenantOverride(enabled: false) removes any Entitlement(source: override) row instead of granting one', async () => {
    const prisma = makePrisma()
    const repo = createModuleRepository(prisma as never)

    await repo.upsertTenantOverride('tenant-1', 'module-1', false)

    expect(prisma.entitlement.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', productId: DEFAULT_PRODUCT_ID, moduleId: 'module-1', source: 'override' },
    })
    expect(prisma.entitlement.upsert).not.toHaveBeenCalled()
  })

  it('deleteTenantOverride also removes the corresponding Entitlement row', async () => {
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
