import { describe, it, expect, vi } from 'vitest'
import { createProductRoleRepository } from './product-role.repository.js'
import { ConflictError } from '../../errors.js'

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    productRole: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    userProductRole: {
      upsert: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  }
}

// c1 (7.2, PR8): ProductRole/UserProductRole admin CRUD — see design
// "Per-Product Roles / JWT". @@unique([productId, key]) must surface as a
// 409 ConflictError, mirroring plan.repository.ts's P2002 handling.
describe('ProductRoleRepository', () => {
  it('findAllByProduct scopes to the given productId', async () => {
    const prisma = makePrisma()
    const repo = createProductRoleRepository(prisma as never)

    await repo.findAllByProduct('instagram-dashboard')

    expect(prisma.productRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productId: 'instagram-dashboard' } }),
    )
  })

  it('findById returns null when the role does not exist', async () => {
    const prisma = makePrisma()
    const repo = createProductRoleRepository(prisma as never)

    const result = await repo.findById('missing')

    expect(result).toBeNull()
  })

  it('create persists the role for the given product', async () => {
    const now = new Date('2026-08-01')
    const prisma = makePrisma({
      productRole: {
        create: vi.fn().mockResolvedValue({
          id: 'role-1',
          productId: 'instagram-dashboard',
          key: 'analyst',
          name: 'Analyst',
          createdAt: now,
          updatedAt: now,
        }),
      },
    })
    const repo = createProductRoleRepository(prisma as never)

    const role = await repo.create({ productId: 'instagram-dashboard', key: 'analyst', name: 'Analyst' })

    expect(role).toEqual({ id: 'role-1', productId: 'instagram-dashboard', key: 'analyst', name: 'Analyst', createdAt: now, updatedAt: now })
    expect(prisma.productRole.create).toHaveBeenCalledWith({
      data: { productId: 'instagram-dashboard', key: 'analyst', name: 'Analyst' },
    })
  })

  it('create throws ConflictError on a duplicate (productId, key) — P2002', async () => {
    const prisma = makePrisma({
      productRole: {
        create: vi.fn().mockRejectedValue({ code: 'P2002' }),
      },
    })
    const repo = createProductRoleRepository(prisma as never)

    await expect(repo.create({ productId: 'instagram-dashboard', key: 'analyst', name: 'Analyst' })).rejects.toBeInstanceOf(ConflictError)
  })

  it('update renames the role', async () => {
    const now = new Date('2026-08-01')
    const prisma = makePrisma({
      productRole: {
        update: vi.fn().mockResolvedValue({
          id: 'role-1',
          productId: 'instagram-dashboard',
          key: 'analyst',
          name: 'Senior Analyst',
          createdAt: now,
          updatedAt: now,
        }),
      },
    })
    const repo = createProductRoleRepository(prisma as never)

    const role = await repo.update('role-1', { name: 'Senior Analyst' })

    expect(role.name).toBe('Senior Analyst')
    expect(prisma.productRole.update).toHaveBeenCalledWith({ where: { id: 'role-1' }, data: { name: 'Senior Analyst' } })
  })

  it('delete removes the role by id', async () => {
    const prisma = makePrisma()
    const repo = createProductRoleRepository(prisma as never)

    await repo.delete('role-1')

    expect(prisma.productRole.delete).toHaveBeenCalledWith({ where: { id: 'role-1' } })
  })

  it('assignToUser upserts a UserProductRole row keyed on [userId, productRoleId]', async () => {
    const now = new Date('2026-08-01')
    const prisma = makePrisma({
      userProductRole: {
        upsert: vi.fn().mockResolvedValue({ userId: 'user-1', productRoleId: 'role-1', assignedBy: 'admin-1', createdAt: now }),
      },
    })
    const repo = createProductRoleRepository(prisma as never)

    const assignment = await repo.assignToUser('user-1', 'role-1', 'admin-1')

    expect(assignment).toEqual({ userId: 'user-1', productRoleId: 'role-1', assignedBy: 'admin-1', createdAt: now })
    expect(prisma.userProductRole.upsert).toHaveBeenCalledWith({
      where: { userId_productRoleId: { userId: 'user-1', productRoleId: 'role-1' } },
      create: { userId: 'user-1', productRoleId: 'role-1', assignedBy: 'admin-1' },
      update: { assignedBy: 'admin-1' },
    })
  })

  it('unassignFromUser deletes the UserProductRole row', async () => {
    const prisma = makePrisma()
    const repo = createProductRoleRepository(prisma as never)

    await repo.unassignFromUser('user-1', 'role-1')

    expect(prisma.userProductRole.delete).toHaveBeenCalledWith({
      where: { userId_productRoleId: { userId: 'user-1', productRoleId: 'role-1' } },
    })
  })

  it('listByUser scopes to the given userId', async () => {
    const prisma = makePrisma()
    const repo = createProductRoleRepository(prisma as never)

    await repo.listByUser('user-1')

    expect(prisma.userProductRole.findMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
  })
})
