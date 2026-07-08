import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPasswordService } from './password.service.js'
import { ValidationError, RateLimitError } from '../errors.js'
import { silentLogger } from '../test-helpers/logger.js'
import type { UserRepository, PasswordResetTokenRepository, RefreshTokenRepository } from '../repositories/index.js'
import type { EmailAdapter, RateLimiter } from '../adapters/index.js'
import type { TokenService } from './token.service.js'
import type { Config } from '../config.js'
import type { RefreshToken } from '../domain/index.js'

vi.mock('argon2', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$argon2id$v=19$hash'),
    verify: vi.fn().mockResolvedValue(true),
    argon2id: 2,
  },
}))

function makeConfig(): Config {
  return {
    BANCARD_RETURN_URL: 'http://localhost:3001/onboarding/payment/return',
    JWT_OTP_VERIFICATION_AUDIENCE: 'otp-verification',
  } as unknown as Config
}

function makeRefreshToken(overrides?: Partial<RefreshToken>): RefreshToken {
  return {
    id: 'rt-1',
    userId: 'user-1',
    tokenHash: 'hash',
    familyId: 'family-1',
    usedAt: undefined,
    expiresAt: new Date(Date.now() + 604800_000),
    createdAt: new Date(),
    parentId: undefined,
    ...overrides,
  }
}

describe('PasswordService', () => {
  let userRepo: UserRepository
  let passwordResetTokenRepo: PasswordResetTokenRepository
  let refreshTokenRepo: RefreshTokenRepository
  let emailAdapter: EmailAdapter
  let tokenService: TokenService
  let rateLimiter: RateLimiter
  let config: Config

  beforeEach(() => {
    userRepo = {
      findByEmail: vi.fn(),
      findByEmailGlobal: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      incrementFailedAttempts: vi.fn(),
      resetFailedAttempts: vi.fn(),
      setLockedUntil: vi.fn(),
      setPasswordHash: vi.fn().mockResolvedValue(undefined),
      listByTenant: vi.fn().mockResolvedValue([]),
      findByActivationTokenHash: vi.fn().mockResolvedValue(null),
      setActivationTokenUsed: vi.fn().mockResolvedValue(undefined),
      findByIdInTenant: vi.fn().mockResolvedValue(null),
      countActiveAdmins: vi.fn().mockResolvedValue(0),
      softDelete: vi.fn().mockResolvedValue(undefined),
      updateProfile: vi.fn(),
      findActiveUserIdsByTenant: vi.fn().mockResolvedValue([]),
    }
    passwordResetTokenRepo = {
      create: vi.fn().mockResolvedValue({ id: 'prt-1', userId: 'user-1', tokenHash: 'h', used: false, expiresAt: new Date(), createdAt: new Date() }),
      findByHash: vi.fn(),
      markUsed: vi.fn().mockResolvedValue(undefined),
      deleteExpired: vi.fn(),
    }
    refreshTokenRepo = {
      create: vi.fn(),
      findByHash: vi.fn(),
      findByHashForUpdate: vi.fn(),
      markUsedByHash: vi.fn(),
      invalidateFamily: vi.fn().mockResolvedValue(undefined),
      findActiveByUserId: vi.fn().mockResolvedValue([makeRefreshToken()]),
      deleteExpired: vi.fn(),
      invalidateAllForUser: vi.fn().mockResolvedValue(undefined),
    }
    emailAdapter = {
      send: vi.fn().mockResolvedValue(undefined),
      sendPlanChangeNotification: vi.fn().mockResolvedValue(undefined),
    }
    tokenService = {
      signAccessToken: vi.fn(),
      verifyAccessToken: vi.fn(),
      signRefreshTokenRaw: vi.fn(),
      verifyOtpVerificationToken: vi.fn(),
      getJwks: vi.fn(),
    } as unknown as TokenService
    rateLimiter = {
      check: vi.fn().mockReturnValue(true),
      increment: vi.fn(),
      remaining: vi.fn().mockReturnValue(5),
    }
    config = makeConfig()
  })

  describe('hashPassword + verifyPassword', () => {
    it('round-trips: hash and verify with argon2', async () => {
      const service = createPasswordService({
        userRepo,
        passwordResetTokenRepo,
        refreshTokenRepo,
        emailAdapter,
        tokenService,
        rateLimiter,
        config,
        logger: silentLogger,
      })

      const hash = await service.hashPassword('TestPassword!1')
      expect(hash).toBe('$argon2id$v=19$hash')

      const valid = await service.verifyPassword('TestPassword!1', hash)
      expect(valid).toBe(true)
    })
  })

  describe('requestRecovery', () => {
    it('calls emailAdapter.send for existing user', async () => {
      vi.mocked(userRepo.findByEmailGlobal).mockResolvedValue({
        id: 'user-1',
        email: 'alice@example.com',
        tenantId: 'tenant-1',
        passwordHash: '$argon2id$hash',
        role: 'User',
        fullName: undefined,
        phone: undefined,
        picture: undefined,
        status: 'active',
        failedLoginAttempts: 0,
        lockedUntil: undefined,
        activationTokenHash: undefined,
        activationTokenExpiresAt: undefined,
        activationTokenUsed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: undefined,
      })

      const service = createPasswordService({
        userRepo,
        passwordResetTokenRepo,
        refreshTokenRepo,
        emailAdapter,
        tokenService,
        rateLimiter,
        config,
        logger: silentLogger,
      })

      await service.requestRecovery({
        email: 'alice@example.com',
        ipAddress: '127.0.0.1',
      })

      expect(emailAdapter.send).toHaveBeenCalledOnce()
      expect(passwordResetTokenRepo.create).toHaveBeenCalledOnce()
    })

    it('silently returns for unknown user (no enumeration)', async () => {
      vi.mocked(userRepo.findByEmailGlobal).mockResolvedValue(null)

      const service = createPasswordService({
        userRepo,
        passwordResetTokenRepo,
        refreshTokenRepo,
        emailAdapter,
        tokenService,
        rateLimiter,
        config,
        logger: silentLogger,
      })

      await expect(
        service.requestRecovery({
          email: 'unknown@example.com',
          ipAddress: '127.0.0.1',
        }),
      ).resolves.toBeUndefined()

      expect(emailAdapter.send).not.toHaveBeenCalled()
      expect(passwordResetTokenRepo.create).not.toHaveBeenCalled()
    })

    it('throws RateLimitError when rate limited', async () => {
      vi.mocked(rateLimiter.check).mockReturnValue(false)

      const service = createPasswordService({
        userRepo,
        passwordResetTokenRepo,
        refreshTokenRepo,
        emailAdapter,
        tokenService,
        rateLimiter,
        config,
        logger: silentLogger,
      })

      await expect(
        service.requestRecovery({
          email: 'alice@example.com',
          ipAddress: '127.0.0.1',
        }),
      ).rejects.toThrow(RateLimitError)
    })
  })

  describe('completeRecovery', () => {
    it('throws ValidationError on password policy violation', async () => {
      vi.mocked(tokenService.verifyOtpVerificationToken).mockResolvedValue({
        sub: 'user-1',
        purpose: 'recover',
        otpId: 'otp-1',
      })

      const service = createPasswordService({
        userRepo,
        passwordResetTokenRepo,
        refreshTokenRepo,
        emailAdapter,
        tokenService,
        rateLimiter,
        config,
        logger: silentLogger,
      })

      await expect(
        service.completeRecovery({
          otpVerificationToken: 'valid.token',
          newPassword: 'weak',
        }),
      ).rejects.toThrow(ValidationError)
    })

    it('calls setPasswordHash and invalidates all active refresh tokens on success', async () => {
      vi.mocked(tokenService.verifyOtpVerificationToken).mockResolvedValue({
        sub: 'user-1',
        purpose: 'recover',
        otpId: 'otp-1',
      })
      vi.mocked(refreshTokenRepo.findActiveByUserId).mockResolvedValue([
        makeRefreshToken({ familyId: 'family-1' }),
        makeRefreshToken({ id: 'rt-2', familyId: 'family-2' }),
      ])

      const service = createPasswordService({
        userRepo,
        passwordResetTokenRepo,
        refreshTokenRepo,
        emailAdapter,
        tokenService,
        rateLimiter,
        config,
        logger: silentLogger,
      })

      await service.completeRecovery({
        otpVerificationToken: 'valid.token',
        newPassword: 'ValidPassword!1',
      })

      expect(userRepo.setPasswordHash).toHaveBeenCalledWith('user-1', expect.any(String))
      expect(refreshTokenRepo.invalidateFamily).toHaveBeenCalledTimes(2)
    })
  })
})
