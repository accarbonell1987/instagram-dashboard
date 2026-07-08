import { describe, it, expect, vi } from 'vitest'
import { createIdentityService } from './identity.service.js'
import { ForbiddenError, NotFoundError } from '../errors.js'
import type { IdentityServiceDeps } from './identity.service.js'
import type { PrismaClient } from '../generated/prisma/client.js'

function makeTenant() {
  return {
    id: 'tenant-uuid-1',
    slug: 'acme',
    name: 'ACME Corp',
    schemaName: 'tenant_acme',
    planId: 'professional',
    status: 'active' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    tenantId: 'tenant-uuid-1',
    email: 'alice@example.com',
    passwordHash: undefined,
    role: 'TenantAdmin' as const,
    fullName: 'Alice Smith',
    phone: undefined,
    picture: undefined,
    status: 'active' as const,
    failedLoginAttempts: 0,
    lockedUntil: undefined,
    activationTokenHash: undefined,
    activationTokenExpiresAt: undefined,
    activationTokenUsed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined,
    ...overrides,
  }
}

function makeDeps(overrides: Partial<IdentityServiceDeps> = {}): IdentityServiceDeps {
  const mockTransaction = vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb({}))
  return {
    tokenService: {
      signAccessToken: vi.fn().mockResolvedValue({ accessToken: 'new-token', expiresIn: 900, tokenType: 'Bearer' }),
      verifyAccessToken: vi.fn(),
      signRefreshTokenRaw: vi.fn(),
      verifyOtpVerificationToken: vi.fn(),
      getJwks: vi.fn(),
    },
    tenantRepo: {
      findBySlug: vi.fn(),
      findByUuid: vi.fn().mockResolvedValue(makeTenant()),
      create: vi.fn(),
      updateStatus: vi.fn(),
      updateName: vi.fn().mockResolvedValue(undefined),
      findAllPaginated: vi.fn(),
      findByIdWithDetail: vi.fn(),
    },
    userRepo: {
      findByEmail: vi.fn(),
      findByEmailGlobal: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      incrementFailedAttempts: vi.fn(),
      resetFailedAttempts: vi.fn(),
      setLockedUntil: vi.fn(),
      setPasswordHash: vi.fn(),
      listByTenant: vi.fn().mockResolvedValue([makeUser()]),
      findByActivationTokenHash: vi.fn().mockResolvedValue(null),
      setActivationTokenUsed: vi.fn().mockResolvedValue(undefined),
      findByIdInTenant: vi.fn().mockResolvedValue(null),
      countActiveAdmins: vi.fn().mockResolvedValue(0),
      softDelete: vi.fn().mockResolvedValue(undefined),
      updateProfile: vi.fn(),
      findActiveUserIdsByTenant: vi.fn().mockResolvedValue([]),
    },
    refreshTokenRepo: {
      create: vi.fn(),
      findByHash: vi.fn(),
      findByHashForUpdate: vi.fn(),
      markUsedByHash: vi.fn(),
      invalidateFamily: vi.fn(),
      findActiveByUserId: vi.fn(),
      deleteExpired: vi.fn(),
      invalidateAllForUser: vi.fn().mockResolvedValue(undefined),
    },
    prisma: { $transaction: mockTransaction } as unknown as PrismaClient,
    ...overrides,
  }
}

describe('IdentityService', () => {
  describe('getCurrentTenant', () => {
    it('delegates to tenantRepo.findByUuid and returns tenant', async () => {
      const deps = makeDeps()
      const service = createIdentityService(deps)

      const tenant = await service.getCurrentTenant('tenant-uuid-1')

      expect(tenant.id).toBe('tenant-uuid-1')
      expect(tenant.slug).toBe('acme')
      expect(deps.tenantRepo.findByUuid).toHaveBeenCalledWith('tenant-uuid-1')
    })

    it('propagates NotFoundError from repository for unknown uuid', async () => {
      const deps = makeDeps({
        tenantRepo: {
          findBySlug: vi.fn(),
          findByUuid: vi.fn().mockRejectedValue(new NotFoundError('tenant.not_found')),
          create: vi.fn(),
          updateStatus: vi.fn(),
          updateName: vi.fn(),
          findAllPaginated: vi.fn(),
          findByIdWithDetail: vi.fn(),
        },
      })
      const service = createIdentityService(deps)

      await expect(service.getCurrentTenant('unknown-uuid')).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  describe('getMembers', () => {
    it('happy path — returns members list for TenantAdmin', async () => {
      const deps = makeDeps()
      const service = createIdentityService(deps)

      const result = await service.getMembers({
        tenantUuid: 'tenant-uuid-1',
        requesterRole: 'TenantAdmin',
      })

      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.id).toBe('user-1')
      expect(result.items[0]!.email).toBe('alice@example.com')
      expect(result.items[0]!.role).toBe('TenantAdmin')
      expect(deps.userRepo.listByTenant).toHaveBeenCalledWith('tenant-uuid-1')
    })

    it('happy path — SuperAdmin can also list members', async () => {
      const deps = makeDeps()
      const service = createIdentityService(deps)

      const result = await service.getMembers({
        tenantUuid: 'tenant-uuid-1',
        requesterRole: 'SuperAdmin',
      })

      expect(result.items).toHaveLength(1)
    })

    it('throws ForbiddenError for User role', async () => {
      const deps = makeDeps()
      const service = createIdentityService(deps)

      await expect(
        service.getMembers({ tenantUuid: 'tenant-uuid-1', requesterRole: 'User' }),
      ).rejects.toBeInstanceOf(ForbiddenError)
    })

    it('returns empty items array when no active members', async () => {
      const deps = makeDeps({
        userRepo: {
          findByEmail: vi.fn(),
          findByEmailGlobal: vi.fn(),
          findById: vi.fn(),
          create: vi.fn(),
          updateStatus: vi.fn(),
          incrementFailedAttempts: vi.fn(),
          resetFailedAttempts: vi.fn(),
          setLockedUntil: vi.fn(),
          setPasswordHash: vi.fn(),
          listByTenant: vi.fn().mockResolvedValue([]),
          findByActivationTokenHash: vi.fn().mockResolvedValue(null),
          setActivationTokenUsed: vi.fn().mockResolvedValue(undefined),
          findByIdInTenant: vi.fn().mockResolvedValue(null),
          countActiveAdmins: vi.fn().mockResolvedValue(0),
          softDelete: vi.fn().mockResolvedValue(undefined),
      updateProfile: vi.fn(),
      findActiveUserIdsByTenant: vi.fn().mockResolvedValue([]),
      } as IdentityServiceDeps['userRepo'],
      })
      const service = createIdentityService(deps)

      const result = await service.getMembers({
        tenantUuid: 'tenant-uuid-1',
        requesterRole: 'TenantAdmin',
      })

      expect(result.items).toHaveLength(0)
    })
  })
})
