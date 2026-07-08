import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOtpService } from './otp.service.js';
import { GoneError, RateLimitError, ValidationError } from '../errors.js';
import { silentLogger } from '../test-helpers/logger.js';
import type { OtpCodeRepository, UserRepository } from '../repositories/index.js';
import type { OtpAdapter, RateLimiter, KeyProvider } from '../adapters/index.js';
import type { Config } from '../config.js';
import type { OtpCode, User } from '../domain/index.js';

const makeOtpCode = (overrides?: Partial<OtpCode>): OtpCode => ({
  id: 'otp-1',
  identifier: 'alice@example.com',
  channel: 'email',
  purpose: 'login',
  codeHash: '$2b$06$hashvalue',
  attempts: 0,
  used: false,
  lockedUntil: undefined,
  expiresAt: new Date(Date.now() + 300_000),
  createdAt: new Date(),
  ...overrides,
});

const makeUser = (overrides?: Partial<User>): User => ({
  id: 'user-1',
  tenantId: 'tenant-1',
  email: 'alice@example.com',
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
  ...overrides,
});

function makeConfig(overrides?: Partial<Config>): Config {
  return {
    OTP_TTL_SECONDS: 300,
    OTP_MAX_ATTEMPTS: 5,
    OTP_LOCKOUT_SECONDS: 900,
    OTP_RESEND_COOLDOWN_SECONDS: 30,
    JWT_ISSUER: 'https://iam.corehub.com',
    JWT_AUDIENCE: 'corehub-hub',
    JWT_OTP_VERIFICATION_AUDIENCE: 'otp-verification',
    JWT_OTP_VERIFICATION_TTL_SECONDS: 300,
    ...overrides,
  } as unknown as Config;
}

function makeRateLimiter(allowed = true): RateLimiter {
  return {
    check: vi.fn().mockReturnValue(allowed),
    increment: vi.fn(),
    remaining: vi.fn().mockReturnValue(allowed ? 1 : 0),
  };
}

describe('OtpService', () => {
  let otpCodeRepo: OtpCodeRepository;
  let userRepo: UserRepository;
  let otpAdapter: OtpAdapter;
  let rateLimiter: RateLimiter;
  let keyProvider: KeyProvider;
  let config: Config;

  beforeEach(() => {
    otpCodeRepo = {
      create: vi.fn(),
      findActiveById: vi.fn(),
      findActiveByIdOnly: vi.fn(),
      incrementAttempts: vi.fn(),
      markUsed: vi.fn(),
      lockUntil: vi.fn(),
      deleteExpired: vi.fn(),
    };
    userRepo = {
      findByEmail: vi.fn(),
      findByEmailGlobal: vi.fn().mockResolvedValue(makeUser()),
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
    };
    otpAdapter = {
      send: vi.fn().mockResolvedValue(undefined),
    };
    rateLimiter = makeRateLimiter(true);
    keyProvider = {
      getSigningKey: vi.fn(),
      getVerifyingKeys: vi.fn(),
      getJwks: vi.fn(),
    };
    config = makeConfig();
  });

  describe('sendOtp', () => {
    it('calls otpAdapter.send with plain code (not hash)', async () => {
      const otp = makeOtpCode();
      vi.mocked(otpCodeRepo.create).mockResolvedValue(otp);

      const service = createOtpService({ otpCodeRepo, userRepo, otpAdapter, rateLimiter, config, logger: silentLogger });
      const result = await service.sendOtp({
        identifier: 'alice@example.com',
        channel: 'email',
        purpose: 'login',
        ipAddress: '127.0.0.1',
      });

      expect(otpAdapter.send).toHaveBeenCalledOnce();
      const sendCall = vi.mocked(otpAdapter.send).mock.calls[0]![0];
      expect(sendCall.code).toMatch(/^\d{6}$/);
      expect(sendCall.identifier).toBe('alice@example.com');
      expect(sendCall.channel).toBe('email');
      expect(result.otpId).toBe('otp-1');
      expect(result.maskedDestination).toBe('a***@example.com');
    });

    it('throws RateLimitError when identifier 30s rate limit exceeded', async () => {
      const blockedRateLimiter: RateLimiter = {
        check: vi.fn().mockReturnValue(false),
        increment: vi.fn(),
        remaining: vi.fn().mockReturnValue(0),
      };

      const service = createOtpService({
        otpCodeRepo,
        userRepo,
        otpAdapter,
        rateLimiter: blockedRateLimiter,
        config,
        logger: silentLogger,
      });

      await expect(
        service.sendOtp({
          identifier: 'alice@example.com',
          channel: 'email',
          purpose: 'login',
          ipAddress: '127.0.0.1',
        })
      ).rejects.toThrow(RateLimitError);
    });

    it('throws RateLimitError with ip code when IP rate limit exceeded', async () => {
      let callCount = 0;
      const mixedRateLimiter: RateLimiter = {
        check: vi.fn().mockImplementation(() => {
          callCount++;
          return callCount <= 2;
        }),
        increment: vi.fn(),
        remaining: vi.fn().mockReturnValue(0),
      };

      const service = createOtpService({
        otpCodeRepo,
        userRepo,
        otpAdapter,
        rateLimiter: mixedRateLimiter,
        config,
        logger: silentLogger,
      });

      const error = await service
        .sendOtp({
          identifier: 'alice@example.com',
          channel: 'email',
          purpose: 'login',
          ipAddress: '1.2.3.4',
        })
        .catch((e) => e);

      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.code).toBe('auth.rate_limit_exceeded_ip');
    });
  });

  describe('verifyOtp', () => {
    it('throws GoneError on expired OTP (findActiveByIdOnly returns null)', async () => {
      vi.mocked(otpCodeRepo.findActiveByIdOnly).mockResolvedValue(null);

      const service = createOtpService({ otpCodeRepo, userRepo, otpAdapter, rateLimiter, config, logger: silentLogger });
      await expect(
        service.verifyOtp({
          otpId: 'otp-expired',
          code: '123456',
          keyProvider,
          config,
        })
      ).rejects.toThrow(GoneError);
    });

    it('throws RateLimitError when OTP is already locked', async () => {
      const lockedUntil = new Date(Date.now() + 900_000);
      const otp = makeOtpCode({ lockedUntil });
      vi.mocked(otpCodeRepo.findActiveByIdOnly).mockResolvedValue(otp);

      const service = createOtpService({ otpCodeRepo, userRepo, otpAdapter, rateLimiter, config, logger: silentLogger });
      const error = await service
        .verifyOtp({
          otpId: 'otp-1',
          code: '123456',
          keyProvider,
          config,
        })
        .catch((e) => e);

      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.code).toBe('auth.otp_locked');
    });

    it('throws ValidationError with attemptsRemaining on wrong code', async () => {
      const bcrypt = await import('bcryptjs');
      vi.spyOn(bcrypt.default, 'compare').mockResolvedValue(false as never);

      const otp = makeOtpCode({ attempts: 1 });
      vi.mocked(otpCodeRepo.findActiveByIdOnly).mockResolvedValue(otp);
      vi.mocked(otpCodeRepo.incrementAttempts).mockResolvedValue({ ...otp, attempts: 2 });

      const service = createOtpService({ otpCodeRepo, userRepo, otpAdapter, rateLimiter, config, logger: silentLogger });
      const error = await service
        .verifyOtp({
          otpId: 'otp-1',
          code: 'wrong',
          keyProvider,
          config,
        })
        .catch((e) => e);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.code).toBe('auth.otp_invalid');
    });

    it('throws RateLimitError on 5th wrong attempt and locks OTP', async () => {
      const bcrypt = await import('bcryptjs');
      vi.spyOn(bcrypt.default, 'compare').mockResolvedValue(false as never);

      const otp = makeOtpCode({ attempts: 4 });
      vi.mocked(otpCodeRepo.findActiveByIdOnly).mockResolvedValue(otp);
      vi.mocked(otpCodeRepo.incrementAttempts).mockResolvedValue({ ...otp, attempts: 5 });
      vi.mocked(otpCodeRepo.lockUntil).mockResolvedValue(undefined);

      const service = createOtpService({ otpCodeRepo, userRepo, otpAdapter, rateLimiter, config, logger: silentLogger });
      const error = await service
        .verifyOtp({
          otpId: 'otp-1',
          code: 'wrong',
          keyProvider,
          config,
        })
        .catch((e) => e);

      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.code).toBe('auth.otp_locked');
      expect(otpCodeRepo.lockUntil).toHaveBeenCalledOnce();
    });

    it('returns a VerifyOtpResult with verificationToken on correct code', async () => {
      const { generateKeyPair } = await import('jose');
      const pair = await generateKeyPair('RS256');
      vi.mocked(keyProvider.getSigningKey).mockResolvedValue({
        privateKey: pair.privateKey,
        kid: 'test-kid',
      });

      const bcrypt = await import('bcryptjs');
      vi.spyOn(bcrypt.default, 'compare').mockResolvedValue(true as never);

      const otp = makeOtpCode();
      vi.mocked(otpCodeRepo.findActiveByIdOnly).mockResolvedValue(otp);
      vi.mocked(otpCodeRepo.markUsed).mockResolvedValue(undefined);

      const service = createOtpService({ otpCodeRepo, userRepo, otpAdapter, rateLimiter, config, logger: silentLogger });
      const result = await service.verifyOtp({
        otpId: 'otp-1',
        code: '123456',
        keyProvider,
        config,
      });

      expect(typeof result.verificationToken).toBe('string');
      expect(result.verificationToken.split('.').length).toBe(3);
      expect(result.userId).toBe('user-1');
      expect(result.purpose).toBe('login');
      expect(otpCodeRepo.markUsed).toHaveBeenCalledWith('otp-1');
    });
  });
});
