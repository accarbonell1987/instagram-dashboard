import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'crypto'
import { createInvitationService } from './invitation.service.js'
import { ConflictError, GoneError, NotFoundError, ValidationError } from '../errors.js'
import type { InvitationServiceDeps } from './invitation.service.js'
import { silentLogger } from '../test-helpers/logger.js'

function sha256(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

function makeInvitation(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'inv-1',
    email: 'bob@example.com',
    tenantId: 'tenant-1',
    inviterUserId: 'user-0',
    role: 'User' as const,
    tokenHash: sha256('valid-token'),
    usedAt: undefined,
    revokedAt: undefined,
    expiresAt: new Date(Date.now() + 86400 * 1000),
    createdAt: new Date(),
    ...overrides,
  }
}

function makeDeps(overrides: Partial<InvitationServiceDeps> = {}): InvitationServiceDeps {
  const txFn = vi.fn().mockImplementation(async (callback: (tx: unknown) => Promise<void>) => {
    const tx = {
      invitation: { update: vi.fn().mockResolvedValue({}) },
      user: {
        create: vi.fn().mockResolvedValue({
          id: 'new-user-id',
          email: 'bob@example.com',
          role: 'User',
          tenantId: 'tenant-1',
          status: 'active',
        }),
      },
      refreshToken: { create: vi.fn().mockResolvedValue({}) },
    }
    await callback(tx)
  })

  return {
    invitationRepo: {
      findByTokenHash: vi.fn().mockResolvedValue(makeInvitation()),
      markUsed: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue(makeInvitation()),
      listByTenant: vi.fn().mockResolvedValue([]),
      findPendingByEmail: vi.fn().mockResolvedValue(null),
      findById: vi.fn().mockResolvedValue(makeInvitation()),
      revokeById: vi.fn().mockResolvedValue(undefined),
    },
    tenantRepo: {
      findByUuid: vi.fn().mockResolvedValue({ id: 'tenant-1', slug: 'acme', name: 'Acme Corp', schemaName: 'tenant_acme', planId: 'plan-1', status: 'active', createdAt: new Date(), updatedAt: new Date() }),
      findBySlug: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      updateName: vi.fn(),
      findAllPaginated: vi.fn(),
      findByIdWithDetail: vi.fn(),
    },
    userRepo: {
      findByEmail: vi.fn(),
      findByEmailGlobal: vi.fn().mockResolvedValue(null),
      findById: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      incrementFailedAttempts: vi.fn(),
      resetFailedAttempts: vi.fn(),
      setLockedUntil: vi.fn(),
      setPasswordHash: vi.fn(),
      findByActivationTokenHash: vi.fn().mockResolvedValue(null),
      setActivationTokenUsed: vi.fn().mockResolvedValue(undefined),
      listByTenant: vi.fn().mockResolvedValue([]),
      findByIdInTenant: vi.fn().mockResolvedValue(null),
      countActiveAdmins: vi.fn().mockResolvedValue(0),
      softDelete: vi.fn().mockResolvedValue(undefined),
      updateProfile: vi.fn(),
      findActiveUserIdsByTenant: vi.fn().mockResolvedValue([]),
    },
    refreshTokenRepo: {
      create: vi.fn().mockResolvedValue({}),
      findByHash: vi.fn(),
      findByHashForUpdate: vi.fn(),
      markUsedByHash: vi.fn(),
      invalidateFamily: vi.fn(),
      findActiveByUserId: vi.fn(),
      deleteExpired: vi.fn(),
      invalidateAllForUser: vi.fn().mockResolvedValue(undefined),
    },
    tokenService: {
      signAccessToken: vi.fn().mockResolvedValue({
        accessToken: 'access-token',
        expiresIn: 900,
        tokenType: 'Bearer',
      }),
      verifyAccessToken: vi.fn(),
      signRefreshTokenRaw: vi.fn().mockReturnValue('raw-refresh-token'),
      verifyOtpVerificationToken: vi.fn(),
      getJwks: vi.fn(),
    },
    passwordService: {
      hashPassword: vi.fn().mockResolvedValue('$argon2hash'),
      verifyPassword: vi.fn(),
      requestRecovery: vi.fn(),
      completeRecovery: vi.fn(),
      validatePasswordPolicy: vi.fn(),
    },
    config: {
      JWT_REFRESH_TOKEN_TTL_SECONDS: 604800,
    } as unknown as InvitationServiceDeps['config'],
    prisma: { $transaction: txFn } as unknown as InvitationServiceDeps['prisma'],
    logger: silentLogger,
    ...overrides,
  }
}

describe('InvitationService', () => {
  describe('getInvitation', () => {
    it('returns invitation preview for valid unused token', async () => {
      const deps = makeDeps()
      const service = createInvitationService(deps)

      const result = await service.getInvitation('valid-token')

      expect(result.email).toBe('bob@example.com')
      expect(result.status).toBe('pending')
      expect(result.role).toBe('User')
      expect(deps.invitationRepo.findByTokenHash).toHaveBeenCalledWith(sha256('valid-token'))
    })

    it('throws NotFoundError for unknown token', async () => {
      const deps = makeDeps({
        invitationRepo: {
          findByTokenHash: vi.fn().mockResolvedValue(null),
          markUsed: vi.fn(),
          create: vi.fn(),
          listByTenant: vi.fn(),
          findPendingByEmail: vi.fn(),
          findById: vi.fn(),
          revokeById: vi.fn(),
        },
      })
      const service = createInvitationService(deps)

      await expect(service.getInvitation('unknown-token')).rejects.toBeInstanceOf(NotFoundError)
    })

    it('throws ConflictError for used invitation', async () => {
      const invitation = makeInvitation({ usedAt: new Date() })
      const deps = makeDeps({
        invitationRepo: {
          findByTokenHash: vi.fn().mockResolvedValue(invitation),
          markUsed: vi.fn(),
          create: vi.fn(),
          listByTenant: vi.fn(),
          findPendingByEmail: vi.fn(),
          findById: vi.fn(),
          revokeById: vi.fn(),
        },
      })
      const service = createInvitationService(deps)

      await expect(service.getInvitation('used-token')).rejects.toBeInstanceOf(ConflictError)
    })

    it('throws GoneError for expired invitation', async () => {
      const invitation = makeInvitation({ expiresAt: new Date(Date.now() - 1000) })
      const deps = makeDeps({
        invitationRepo: {
          findByTokenHash: vi.fn().mockResolvedValue(invitation),
          markUsed: vi.fn(),
          create: vi.fn(),
          listByTenant: vi.fn(),
          findPendingByEmail: vi.fn(),
          findById: vi.fn(),
          revokeById: vi.fn(),
        },
      })
      const service = createInvitationService(deps)

      await expect(service.getInvitation('expired-token')).rejects.toBeInstanceOf(GoneError)
    })
  })

  describe('acceptInvitation', () => {
    it('creates user + session on happy path', async () => {
      const deps = makeDeps()
      const service = createInvitationService(deps)

      const result = await service.acceptInvitation({
        token: 'valid-token',
        password: 'ValidP@ss12!',
      })

      expect(result.session.accessToken).toBe('access-token')
      expect(result.session.user.email).toBe('bob@example.com')
      expect(result.refreshTokenRaw).toBe('raw-refresh-token')
      expect(deps.passwordService.hashPassword).toHaveBeenCalledWith('ValidP@ss12!')
      expect(deps.prisma.$transaction).toHaveBeenCalled()
    })

    it('throws when password policy validation fails', async () => {
      const deps = makeDeps({
        passwordService: {
          hashPassword: vi.fn(),
          verifyPassword: vi.fn(),
          requestRecovery: vi.fn(),
          completeRecovery: vi.fn(),
          validatePasswordPolicy: vi.fn().mockImplementation(() => {
            throw new ValidationError('auth.password_policy_violation')
          }),
        },
      })
      const service = createInvitationService(deps)

      await expect(
        service.acceptInvitation({ token: 'valid-token', password: 'weak' }),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws NotFoundError when invitation does not exist', async () => {
      const deps = makeDeps({
        invitationRepo: {
          findByTokenHash: vi.fn().mockResolvedValue(null),
          markUsed: vi.fn(),
          create: vi.fn(),
          listByTenant: vi.fn(),
          findPendingByEmail: vi.fn(),
          findById: vi.fn(),
          revokeById: vi.fn(),
        },
      })
      const service = createInvitationService(deps)

      await expect(
        service.acceptInvitation({ token: 'unknown', password: 'ValidP@ss12!' }),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('throws ConflictError for already-used invitation', async () => {
      const invitation = makeInvitation({ usedAt: new Date() })
      const deps = makeDeps({
        invitationRepo: {
          findByTokenHash: vi.fn().mockResolvedValue(invitation),
          markUsed: vi.fn(),
          create: vi.fn(),
          listByTenant: vi.fn(),
          findPendingByEmail: vi.fn(),
          findById: vi.fn(),
          revokeById: vi.fn(),
        },
      })
      const service = createInvitationService(deps)

      await expect(
        service.acceptInvitation({ token: 'used-token', password: 'ValidP@ss12!' }),
      ).rejects.toBeInstanceOf(ConflictError)
    })
  })

  // ── Task 2.4 — createInvitation ────────────────────────────────────────

  describe('createInvitation', () => {
    it('happy path — creates invitation and returns result', async () => {
      const createdInvitation = makeInvitation({ id: 'inv-new', email: 'new@example.com', role: 'TenantAdmin' as const })
      const deps = makeDeps({
        invitationRepo: {
          findByTokenHash: vi.fn(),
          markUsed: vi.fn(),
          create: vi.fn().mockResolvedValue(createdInvitation),
          listByTenant: vi.fn(),
          findPendingByEmail: vi.fn().mockResolvedValue(null),
          findById: vi.fn(),
          revokeById: vi.fn(),
        },
        userRepo: {
          findByEmail: vi.fn(),
          findByEmailGlobal: vi.fn().mockResolvedValue(null),
          findById: vi.fn(),
          create: vi.fn(),
          updateStatus: vi.fn(),
          incrementFailedAttempts: vi.fn(),
          resetFailedAttempts: vi.fn(),
          setLockedUntil: vi.fn(),
          setPasswordHash: vi.fn(),
          findByActivationTokenHash: vi.fn().mockResolvedValue(null),
          setActivationTokenUsed: vi.fn().mockResolvedValue(undefined),
          listByTenant: vi.fn().mockResolvedValue([]),
          findByIdInTenant: vi.fn().mockResolvedValue(null),
          countActiveAdmins: vi.fn().mockResolvedValue(0),
          softDelete: vi.fn().mockResolvedValue(undefined),
      updateProfile: vi.fn(),
      findActiveUserIdsByTenant: vi.fn().mockResolvedValue([]),
        },
      })
      const service = createInvitationService(deps)

      const result = await service.createInvitation({
        tenantUuid: 'tenant-1',
        inviterUserId: 'user-admin',
        email: 'new@example.com',
        role: 'TenantAdmin',
      })

      expect(result.id).toBe('inv-new')
      expect(result.email).toBe('new@example.com')
      expect(result.role).toBe('TenantAdmin')
      expect(result.expiresAt).toBeInstanceOf(Date)
      expect(deps.invitationRepo.create).toHaveBeenCalled()
    })

    it('throws ConflictError when email belongs to active user in tenant', async () => {
      const activeUser = { id: 'user-1', tenantId: 'tenant-1', email: 'existing@example.com', role: 'User' as const, status: 'active' as const, passwordHash: undefined, fullName: undefined, picture: undefined, failedLoginAttempts: 0, lockedUntil: undefined, activationTokenHash: undefined, activationTokenExpiresAt: undefined, activationTokenUsed: false, createdAt: new Date(), updatedAt: new Date(), deletedAt: undefined }
      const deps = makeDeps({
        userRepo: {
          findByEmail: vi.fn(),
          findByEmailGlobal: vi.fn().mockResolvedValue(activeUser),
          findById: vi.fn(),
          create: vi.fn(),
          updateStatus: vi.fn(),
          incrementFailedAttempts: vi.fn(),
          resetFailedAttempts: vi.fn(),
          setLockedUntil: vi.fn(),
          setPasswordHash: vi.fn(),
          findByActivationTokenHash: vi.fn().mockResolvedValue(null),
          setActivationTokenUsed: vi.fn().mockResolvedValue(undefined),
          listByTenant: vi.fn().mockResolvedValue([]),
          findByIdInTenant: vi.fn().mockResolvedValue(null),
          countActiveAdmins: vi.fn().mockResolvedValue(0),
          softDelete: vi.fn().mockResolvedValue(undefined),
      updateProfile: vi.fn(),
      findActiveUserIdsByTenant: vi.fn().mockResolvedValue([]),
        },
      })
      const service = createInvitationService(deps)

      await expect(
        service.createInvitation({ tenantUuid: 'tenant-1', inviterUserId: 'admin', email: 'existing@example.com', role: 'User' }),
      ).rejects.toBeInstanceOf(ConflictError)
    })

    it('throws ConflictError when pending invitation already exists', async () => {
      const pendingInvitation = makeInvitation({ email: 'pending@example.com' })
      const deps = makeDeps({
        invitationRepo: {
          findByTokenHash: vi.fn(),
          markUsed: vi.fn(),
          create: vi.fn(),
          listByTenant: vi.fn(),
          findPendingByEmail: vi.fn().mockResolvedValue(pendingInvitation),
          findById: vi.fn(),
          revokeById: vi.fn(),
        },
      })
      const service = createInvitationService(deps)

      await expect(
        service.createInvitation({ tenantUuid: 'tenant-1', inviterUserId: 'admin', email: 'pending@example.com', role: 'User' }),
      ).rejects.toBeInstanceOf(ConflictError)
    })
  })

  // ── Task 2.5 — listInvitations ─────────────────────────────────────────

  describe('listInvitations', () => {
    const now = new Date()
    const future = new Date(Date.now() + 86400 * 1000)
    const past = new Date(Date.now() - 1000)

    function makeRow(overrides: Partial<{ usedAt: Date | undefined; revokedAt: Date | undefined; expiresAt: Date }> = {}) {
      return {
        id: 'inv-1',
        email: 'test@example.com',
        role: 'User' as const,
        tenantId: 'tenant-1',
        createdAt: now,
        expiresAt: future,
        usedAt: undefined,
        revokedAt: undefined,
        ...overrides,
      }
    }

    it('returns all invitations with computed status when no filter', async () => {
      const rows = [
        makeRow(),                                      // pending
        makeRow({ usedAt: now }),                       // accepted
        makeRow({ revokedAt: now }),                    // revoked
        makeRow({ expiresAt: past }),                   // expired
      ]
      const deps = makeDeps({
        invitationRepo: {
          findByTokenHash: vi.fn(),
          markUsed: vi.fn(),
          create: vi.fn(),
          listByTenant: vi.fn().mockResolvedValue(rows),
          findPendingByEmail: vi.fn(),
          findById: vi.fn(),
          revokeById: vi.fn(),
        },
      })
      const service = createInvitationService(deps)

      const result = await service.listInvitations({ tenantUuid: 'tenant-1' })

      expect(result).toHaveLength(4)
      expect(result[0]!.status).toBe('pending')
      expect(result[1]!.status).toBe('accepted')
      expect(result[2]!.status).toBe('revoked')
      expect(result[3]!.status).toBe('expired')
    })

    it('filters by statusFilter when provided', async () => {
      const rows = [
        makeRow(),                   // pending
        makeRow({ usedAt: now }),    // accepted
        makeRow({ revokedAt: now }), // revoked
      ]
      const deps = makeDeps({
        invitationRepo: {
          findByTokenHash: vi.fn(),
          markUsed: vi.fn(),
          create: vi.fn(),
          listByTenant: vi.fn().mockResolvedValue(rows),
          findPendingByEmail: vi.fn(),
          findById: vi.fn(),
          revokeById: vi.fn(),
        },
      })
      const service = createInvitationService(deps)

      const result = await service.listInvitations({ tenantUuid: 'tenant-1', statusFilter: 'pending' })

      expect(result).toHaveLength(1)
      expect(result[0]!.status).toBe('pending')
    })

    it('status priority: revoked > accepted (revokedAt takes precedence)', async () => {
      // Edge case: both usedAt and revokedAt set — revoked wins
      const rows = [makeRow({ usedAt: now, revokedAt: now })]
      const deps = makeDeps({
        invitationRepo: {
          findByTokenHash: vi.fn(),
          markUsed: vi.fn(),
          create: vi.fn(),
          listByTenant: vi.fn().mockResolvedValue(rows),
          findPendingByEmail: vi.fn(),
          findById: vi.fn(),
          revokeById: vi.fn(),
        },
      })
      const service = createInvitationService(deps)

      const result = await service.listInvitations({ tenantUuid: 'tenant-1' })

      expect(result[0]!.status).toBe('revoked')
    })
  })

  // ── Task 2.6 — revokeInvitation ────────────────────────────────────────

  describe('revokeInvitation', () => {
    it('happy path — revokes pending invitation', async () => {
      const deps = makeDeps()
      const service = createInvitationService(deps)

      await service.revokeInvitation({ id: 'inv-1', tenantUuid: 'tenant-1' })

      expect(deps.invitationRepo.revokeById).toHaveBeenCalledWith('inv-1')
    })

    it('throws NotFoundError when invitation not found or wrong tenant', async () => {
      const deps = makeDeps({
        invitationRepo: {
          findByTokenHash: vi.fn(),
          markUsed: vi.fn(),
          create: vi.fn(),
          listByTenant: vi.fn(),
          findPendingByEmail: vi.fn(),
          findById: vi.fn().mockResolvedValue(null),
          revokeById: vi.fn(),
        },
      })
      const service = createInvitationService(deps)

      await expect(
        service.revokeInvitation({ id: 'inv-999', tenantUuid: 'tenant-1' }),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('throws ValidationError when invitation already accepted', async () => {
      const usedInvitation = makeInvitation({ usedAt: new Date() })
      const deps = makeDeps({
        invitationRepo: {
          findByTokenHash: vi.fn(),
          markUsed: vi.fn(),
          create: vi.fn(),
          listByTenant: vi.fn(),
          findPendingByEmail: vi.fn(),
          findById: vi.fn().mockResolvedValue(usedInvitation),
          revokeById: vi.fn(),
        },
      })
      const service = createInvitationService(deps)

      await expect(
        service.revokeInvitation({ id: 'inv-1', tenantUuid: 'tenant-1' }),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError when invitation already revoked', async () => {
      const revokedInvitation = makeInvitation({ revokedAt: new Date() })
      const deps = makeDeps({
        invitationRepo: {
          findByTokenHash: vi.fn(),
          markUsed: vi.fn(),
          create: vi.fn(),
          listByTenant: vi.fn(),
          findPendingByEmail: vi.fn(),
          findById: vi.fn().mockResolvedValue(revokedInvitation),
          revokeById: vi.fn(),
        },
      })
      const service = createInvitationService(deps)

      await expect(
        service.revokeInvitation({ id: 'inv-1', tenantUuid: 'tenant-1' }),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })
})
