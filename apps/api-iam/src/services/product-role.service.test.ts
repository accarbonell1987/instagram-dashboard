import { describe, it, expect, vi } from 'vitest'
import { createProductRoleService } from './product-role.service.js'
import { NotFoundError } from '../errors.js'
import type { ProductRoleServiceDeps } from './product-role.service.js'
import type { ProductRole, UserProductRole } from '../domain/index.js'
import { silentLogger } from '../test-helpers/logger.js'

function makeRole(overrides: Partial<ProductRole> = {}): ProductRole {
  return {
    id: 'role-1',
    productId: 'instagram-dashboard',
    key: 'analyst',
    name: 'Analyst',
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
    ...overrides,
  }
}

function makeAssignment(overrides: Partial<UserProductRole> = {}): UserProductRole {
  return {
    userId: 'user-1',
    productRoleId: 'role-1',
    assignedBy: 'admin-1',
    createdAt: new Date('2026-08-01'),
    ...overrides,
  }
}

function makeDeps(overrides: Partial<ProductRoleServiceDeps> = {}): ProductRoleServiceDeps {
  return {
    productRoleRepository: {
      findAllByProduct: vi.fn().mockResolvedValue([makeRole()]),
      findById: vi.fn().mockResolvedValue(makeRole()),
      create: vi.fn().mockResolvedValue(makeRole()),
      update: vi.fn().mockResolvedValue(makeRole({ name: 'Senior Analyst' })),
      delete: vi.fn().mockResolvedValue(undefined),
      assignToUser: vi.fn().mockResolvedValue(makeAssignment()),
      unassignFromUser: vi.fn().mockResolvedValue(undefined),
      listByUser: vi.fn().mockResolvedValue([makeAssignment()]),
      listRoleKeysByUser: vi.fn().mockResolvedValue([]),
    },
    userRepo: {
      findById: vi.fn().mockResolvedValue({ id: 'user-1' }),
    } as unknown as ProductRoleServiceDeps['userRepo'],
    logger: silentLogger,
    ...overrides,
  }
}

describe('ProductRoleService', () => {
  it('listByProduct delegates to the repository', async () => {
    const deps = makeDeps()
    const service = createProductRoleService(deps)

    const roles = await service.listByProduct('instagram-dashboard')

    expect(roles).toEqual([makeRole()])
    expect(deps.productRoleRepository.findAllByProduct).toHaveBeenCalledWith('instagram-dashboard')
  })

  it('create delegates to the repository', async () => {
    const deps = makeDeps()
    const service = createProductRoleService(deps)

    await service.create({ productId: 'instagram-dashboard', key: 'analyst', name: 'Analyst' })

    expect(deps.productRoleRepository.create).toHaveBeenCalledWith({ productId: 'instagram-dashboard', key: 'analyst', name: 'Analyst' })
  })

  it('update throws NotFoundError when the role does not exist', async () => {
    const deps = makeDeps({
      productRoleRepository: {
        ...makeDeps().productRoleRepository,
        findById: vi.fn().mockResolvedValue(null),
      },
    })
    const service = createProductRoleService(deps)

    await expect(service.update('missing', { name: 'X' })).rejects.toBeInstanceOf(NotFoundError)
  })

  it('update renames an existing role', async () => {
    const deps = makeDeps()
    const service = createProductRoleService(deps)

    const role = await service.update('role-1', { name: 'Senior Analyst' })

    expect(role.name).toBe('Senior Analyst')
    expect(deps.productRoleRepository.update).toHaveBeenCalledWith('role-1', { name: 'Senior Analyst' })
  })

  it('remove throws NotFoundError when the role does not exist', async () => {
    const deps = makeDeps({
      productRoleRepository: {
        ...makeDeps().productRoleRepository,
        findById: vi.fn().mockResolvedValue(null),
      },
    })
    const service = createProductRoleService(deps)

    await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('remove deletes an existing role', async () => {
    const deps = makeDeps()
    const service = createProductRoleService(deps)

    await service.remove('role-1')

    expect(deps.productRoleRepository.delete).toHaveBeenCalledWith('role-1')
  })

  it('assignToUser throws NotFoundError when the role does not exist', async () => {
    const deps = makeDeps({
      productRoleRepository: {
        ...makeDeps().productRoleRepository,
        findById: vi.fn().mockResolvedValue(null),
      },
    })
    const service = createProductRoleService(deps)

    await expect(service.assignToUser('user-1', 'missing', 'admin-1')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('assignToUser propagates the user lookup failure when the user does not exist', async () => {
    const deps = makeDeps({
      userRepo: { findById: vi.fn().mockRejectedValue(new NotFoundError('auth.user_not_found')) } as unknown as ProductRoleServiceDeps['userRepo'],
    })
    const service = createProductRoleService(deps)

    await expect(service.assignToUser('missing-user', 'role-1', 'admin-1')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('assignToUser delegates to the repository once role and user are verified', async () => {
    const deps = makeDeps()
    const service = createProductRoleService(deps)

    const assignment = await service.assignToUser('user-1', 'role-1', 'admin-1')

    expect(assignment).toEqual(makeAssignment())
    expect(deps.productRoleRepository.assignToUser).toHaveBeenCalledWith('user-1', 'role-1', 'admin-1')
  })

  it('unassignFromUser delegates to the repository', async () => {
    const deps = makeDeps()
    const service = createProductRoleService(deps)

    await service.unassignFromUser('user-1', 'role-1')

    expect(deps.productRoleRepository.unassignFromUser).toHaveBeenCalledWith('user-1', 'role-1')
  })

  it('listByUser delegates to the repository', async () => {
    const deps = makeDeps()
    const service = createProductRoleService(deps)

    const roles = await service.listByUser('user-1')

    expect(roles).toEqual([makeAssignment()])
    expect(deps.productRoleRepository.listByUser).toHaveBeenCalledWith('user-1')
  })
})
