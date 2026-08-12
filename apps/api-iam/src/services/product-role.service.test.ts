import { describe, it, expect, vi } from 'vitest'
import { createProductRoleService } from './product-role.service.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js'
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
      findAllByProducts: vi.fn().mockResolvedValue([{ ...makeRole(), moduleCount: 3 }]),
      listRolesByUsers: vi.fn().mockResolvedValue([{ userId: 'user-1', role: makeRole() }]),
      replaceUserRoles: vi.fn().mockResolvedValue(undefined),
      listRoleKeysByUser: vi.fn().mockResolvedValue([]),
      getRoleModules: vi.fn().mockResolvedValue([]),
      setRoleModules: vi.fn().mockResolvedValue(undefined),
    },
    moduleRepository: {
      findAvailableProducts: vi
        .fn()
        .mockResolvedValue([{ id: 'instagram-dashboard', name: 'Instagram Dashboard' }]),
    } as unknown as ProductRoleServiceDeps['moduleRepository'],
    userRepo: {
      findById: vi.fn().mockResolvedValue({ id: 'user-1' }),
      findByIdInTenant: vi.fn().mockResolvedValue({ id: 'user-1' }),
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

// ─── Tenant-scoped ─────────────────────────────────────────────────────────────

describe('ProductRoleService — tenant-scoped', () => {
  const setRoles = (overrides: Record<string, unknown> = {}) => ({
    tenantUuid: 'tenant-1',
    memberId: 'user-1',
    productRoleIds: ['role-1'],
    requesterRole: 'TenantAdmin',
    assignedBy: 'admin-1',
    ...overrides,
  })

  it('lists only the roles of products the tenant contracted', async () => {
    const deps = makeDeps()
    const service = createProductRoleService(deps)

    const result = await service.listRolesForTenant('tenant-1')

    expect(deps.productRoleRepository.findAllByProducts).toHaveBeenCalledWith([
      'instagram-dashboard',
    ])
    expect(result).toEqual([
      {
        productId: 'instagram-dashboard',
        productName: 'Instagram Dashboard',
        roles: [{ ...makeRole(), moduleCount: 3 }],
      },
    ])
  })

  it('groups member roles by user in a single query', async () => {
    const deps = makeDeps()
    const service = createProductRoleService(deps)

    const byUser = await service.listRolesForMembers(['user-1', 'user-2'])

    expect(deps.productRoleRepository.listRolesByUsers).toHaveBeenCalledTimes(1)
    expect(byUser.get('user-1')).toEqual([makeRole()])
    expect(byUser.get('user-2')).toBeUndefined()
  })

  it('replaces the roles within the tenant products only', async () => {
    const deps = makeDeps()
    const service = createProductRoleService(deps)

    await service.setMemberRoles(setRoles())

    expect(deps.productRoleRepository.replaceUserRoles).toHaveBeenCalledWith(
      'user-1',
      ['instagram-dashboard'],
      ['role-1'],
      'admin-1',
    )
  })

  it('clears every role when given an empty set', async () => {
    const deps = makeDeps()
    const service = createProductRoleService(deps)

    await service.setMemberRoles(setRoles({ productRoleIds: [] }))

    expect(deps.productRoleRepository.replaceUserRoles).toHaveBeenCalledWith(
      'user-1',
      ['instagram-dashboard'],
      [],
      'admin-1',
    )
  })

  it('refuses a plain User', async () => {
    const deps = makeDeps()
    const service = createProductRoleService(deps)

    await expect(service.setMemberRoles(setRoles({ requesterRole: 'User' }))).rejects.toThrow(
      ForbiddenError,
    )
    expect(deps.productRoleRepository.replaceUserRoles).not.toHaveBeenCalled()
  })

  /**
   * 404 and not 403: telling one tenant that a user id exists somewhere else
   * is an existence oracle over the whole platform.
   */
  it('treats a member of another tenant as missing', async () => {
    const deps = makeDeps()
    deps.userRepo.findByIdInTenant = vi.fn().mockResolvedValue(null)
    const service = createProductRoleService(deps)

    await expect(service.setMemberRoles(setRoles())).rejects.toThrow(NotFoundError)
    expect(deps.productRoleRepository.replaceUserRoles).not.toHaveBeenCalled()
  })

  it('refuses a role from a product the tenant did not contract', async () => {
    const deps = makeDeps()
    const service = createProductRoleService(deps)

    await expect(
      service.setMemberRoles(setRoles({ productRoleIds: ['role-from-another-product'] })),
    ).rejects.toThrow(ValidationError)
    expect(deps.productRoleRepository.replaceUserRoles).not.toHaveBeenCalled()
  })

  // Two roles in one product would union their modules — no screen shows that.
  it('refuses two roles for the same product', async () => {
    const deps = makeDeps()
    deps.productRoleRepository.findAllByProducts = vi.fn().mockResolvedValue([
      { ...makeRole({ id: 'role-1', key: 'analyst' }), moduleCount: 3 },
      { ...makeRole({ id: 'role-2', key: 'viewer' }), moduleCount: 1 },
    ])
    const service = createProductRoleService(deps)

    await expect(
      service.setMemberRoles(setRoles({ productRoleIds: ['role-1', 'role-2'] })),
    ).rejects.toThrow(ValidationError)
    expect(deps.productRoleRepository.replaceUserRoles).not.toHaveBeenCalled()
  })
})
