import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuthService } from './auth.service.js';
import { UnauthorizedError, ForbiddenError, RateLimitError } from '../errors.js';
import { silentLogger } from '../test-helpers/logger.js';
import type {
  UserRepository,
  RefreshTokenRepository,
  DeviceTrustRepository,
  TenantRepository,
  OtpCodeRepository,
} from '../repositories/index.js';
import type { KeyProvider } from '../adapters/index.js';
import type { OtpService } from './otp.service.js';
import type { TokenService } from './token.service.js';
import type { Config } from '../config.js';
import type { User, Tenant, RefreshToken } from '../domain/index.js';

vi.mock('argon2', () => ({
  default: {
    verify: vi.fn(),
    hash: vi.fn().mockResolvedValue('$argon2id$hash'),
    argon2id: 2,
  },
}));

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

const makeTenant = (overrides?: Partial<Tenant>): Tenant => ({
  id: 'tenant-1',
  slug: 'acme',
  name: 'Acme Corp',
  schemaName: 'tenant_acme',
  planId: 'professional',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeRefreshToken = (overrides?: Partial<RefreshToken>): RefreshToken => ({
  id: 'rt-1',
  userId: 'user-1',
  tokenHash: 'oldhash',
  familyId: 'family-1',
  parentId: undefined,
  usedAt: undefined,
  expiresAt: new Date(Date.now() + 604800_000),
  createdAt: new Date(),
  ...overrides,
});

function makeConfig(): Config {
  return {
    JWT_REFRESH_TOKEN_TTL_SECONDS: 604800,
    DEVICE_TRUST_TTL_SECONDS: 5184000,
    OTP_MAX_ATTEMPTS: 5,
  } as unknown as Config;
}

describe('AuthService', () => {
  let userRepo: UserRepository;
  let refreshTokenRepo: RefreshTokenRepository;
  let deviceTrustRepo: DeviceTrustRepository;
  let tenantRepo: TenantRepository;
  let otpCodeRepo: OtpCodeRepository;
  let otpService: OtpService;
  let tokenService: TokenService;
  let keyProvider: KeyProvider;
  let config: Config;
  let prisma: { $transaction: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    userRepo = {
      findByEmail: vi.fn(),
      findByEmailGlobal: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      incrementFailedAttempts: vi.fn().mockResolvedValue({ failedLoginAttempts: 1 }),
      resetFailedAttempts: vi.fn().mockResolvedValue(undefined),
      setLockedUntil: vi.fn().mockResolvedValue(undefined),
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
    otpCodeRepo = {
      create: vi.fn(),
      findActiveById: vi.fn(),
      findActiveByIdOnly: vi.fn(),
      incrementAttempts: vi.fn(),
      markUsed: vi.fn(),
      lockUntil: vi.fn(),
      deleteExpired: vi.fn(),
    };
    refreshTokenRepo = {
      create: vi.fn().mockResolvedValue(makeRefreshToken()),
      findByHash: vi.fn(),
      findByHashForUpdate: vi.fn(),
      markUsedByHash: vi.fn().mockResolvedValue(undefined),
      invalidateFamily: vi.fn().mockResolvedValue(undefined),
      findActiveByUserId: vi.fn().mockResolvedValue([]),
      deleteExpired: vi.fn(),
      invalidateAllForUser: vi.fn().mockResolvedValue(undefined),
    };
    deviceTrustRepo = {
      upsert: vi.fn(),
      findByUserAndHash: vi.fn().mockResolvedValue(null),
      deleteExpired: vi.fn(),
    };
    tenantRepo = {
      findBySlug: vi.fn().mockResolvedValue(makeTenant()),
      findByUuid: vi.fn().mockResolvedValue(makeTenant()),
      create: vi.fn(),
      updateStatus: vi.fn(),
      updateName: vi.fn(),
      findAllPaginated: vi.fn(),
      findByIdWithDetail: vi.fn(),
    };
    otpService = {
      sendOtp: vi.fn().mockResolvedValue({
        otpId: 'otp-1',
        channel: 'email',
        maskedDestination: 'a***@example.com',
        expiresAt: new Date(Date.now() + 300_000),
        resendAvailableAt: new Date(Date.now() + 30_000),
      }),
      verifyOtp: vi.fn().mockResolvedValue('otp.verification.token'),
    } as unknown as OtpService;
    tokenService = {
      signAccessToken: vi.fn().mockResolvedValue({
        accessToken: 'access.token.jwt',
        expiresIn: 900,
        tokenType: 'Bearer',
      }),
      signRefreshTokenRaw: vi.fn().mockReturnValue('raw-refresh-token-64chars'),
      verifyAccessToken: vi.fn(),
      verifyOtpVerificationToken: vi.fn(),
      getJwks: vi.fn(),
    } as unknown as TokenService;
    keyProvider = {
      getSigningKey: vi.fn(),
      getVerifyingKeys: vi.fn(),
      getJwks: vi.fn(),
    };
    config = makeConfig();
    prisma = {
      $transaction: vi.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn({})),
    };
  });

  function makeService() {
    return createAuthService({
      userRepo,
      refreshTokenRepo,
      deviceTrustRepo,
      tenantRepo,
      otpCodeRepo,
      otpService,
      tokenService,
      keyProvider,
      config,
      prisma: prisma as never,
      logger: silentLogger,
    });
  }

  describe('login', () => {
    it('returns otpRequired: true when device is not trusted', async () => {
      const argon2 = await import('argon2');
      vi.mocked(argon2.default.verify).mockResolvedValue(true);
      vi.mocked(userRepo.findByEmailGlobal).mockResolvedValue(makeUser());

      const service = makeService();
      const result = await service.login({
        email: 'alice@example.com',
        password: 'ValidPassword!1',
        ipAddress: '127.0.0.1',
      });

      expect(result.otpRequired).toBe(true);
      expect(otpService.sendOtp).toHaveBeenCalledOnce();
    });

    it('returns otpRequired: false when device is trusted', async () => {
      const argon2 = await import('argon2');
      vi.mocked(argon2.default.verify).mockResolvedValue(true);
      vi.mocked(userRepo.findByEmailGlobal).mockResolvedValue(makeUser());
      // Service computes SHA256("${deviceId}:${userId}") and calls findByUserAndHash with it
      // We stub findByUserAndHash to return a valid trust regardless of hash value
      vi.mocked(deviceTrustRepo.findByUserAndHash).mockResolvedValue({
        id: 'dt-1',
        userId: 'user-1',
        deviceHash: 'any-computed-hash',
        expiresAt: new Date(Date.now() + 5184000_000),
        createdAt: new Date(),
      });

      const service = makeService();
      const result = await service.login({
        email: 'alice@example.com',
        password: 'ValidPassword!1',
        deviceId: '550e8400-e29b-41d4-a716-446655440000',
        ipAddress: '127.0.0.1',
      });

      expect(result.otpRequired).toBe(false);
      expect(otpService.sendOtp).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedError when user not found (no enumeration)', async () => {
      vi.mocked(userRepo.findByEmailGlobal).mockResolvedValue(null);

      const service = makeService();
      await expect(
        service.login({
          email: 'unknown@example.com',
          password: 'any',
          ipAddress: '127.0.0.1',
        })
      ).rejects.toThrow(UnauthorizedError);
    });

    it('throws ForbiddenError for suspended account', async () => {
      vi.mocked(userRepo.findByEmailGlobal).mockResolvedValue(makeUser({ status: 'suspended' }));

      const service = makeService();
      await expect(
        service.login({
          email: 'alice@example.com',
          password: 'any',
          ipAddress: '127.0.0.1',
        })
      ).rejects.toThrow(ForbiddenError);
    });

    // ── T-006 Task 6.2: login rejects pending_first_login (403) ──
    it('throws ForbiddenError for pending_first_login user after valid password', async () => {
      const argon2 = await import('argon2');
      vi.mocked(argon2.default.verify).mockResolvedValue(true);
      vi.mocked(userRepo.findByEmailGlobal).mockResolvedValue(
        makeUser({ status: 'pending_first_login' }),
      );

      const service = makeService();
      const error = await service
        .login({
          email: 'alice@example.com',
          password: 'ValidPassword!1',
          ipAddress: '127.0.0.1',
        })
        .catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenError);
      expect(error.code).toBe('auth.account_pending_activation');
    });

    it('returns 401 (not 403) for pending_first_login user with wrong password', async () => {
      const argon2 = await import('argon2');
      vi.mocked(argon2.default.verify).mockResolvedValue(false);
      vi.mocked(userRepo.findByEmailGlobal).mockResolvedValue(
        makeUser({ status: 'pending_first_login' }),
      );

      const service = makeService();
      await expect(
        service.login({
          email: 'alice@example.com',
          password: 'wrong',
          ipAddress: '127.0.0.1',
        })
      ).rejects.toThrow(UnauthorizedError);
    });

    it('throws RateLimitError for locked account', async () => {
      vi.mocked(userRepo.findByEmailGlobal).mockResolvedValue(
        makeUser({ lockedUntil: new Date(Date.now() + 900_000) })
      );

      const service = makeService();
      await expect(
        service.login({
          email: 'alice@example.com',
          password: 'any',
          ipAddress: '127.0.0.1',
        })
      ).rejects.toThrow(RateLimitError);
    });

    it('throws UnauthorizedError and increments attempts on wrong password', async () => {
      const argon2 = await import('argon2');
      vi.mocked(argon2.default.verify).mockResolvedValue(false);
      vi.mocked(userRepo.findByEmailGlobal).mockResolvedValue(makeUser({ failedLoginAttempts: 2 }));

      const service = makeService();
      await expect(
        service.login({
          email: 'alice@example.com',
          password: 'wrong',
          ipAddress: '127.0.0.1',
        })
      ).rejects.toThrow(UnauthorizedError);

      expect(userRepo.incrementFailedAttempts).toHaveBeenCalledWith('user-1');
    });

    it('locks account on 5th failed attempt', async () => {
      const argon2 = await import('argon2');
      vi.mocked(argon2.default.verify).mockResolvedValue(false);
      vi.mocked(userRepo.findByEmailGlobal).mockResolvedValue(makeUser({ failedLoginAttempts: 4 }));
      // The repo increments and returns the NEW count (5)
      vi.mocked(userRepo.incrementFailedAttempts).mockResolvedValue({ failedLoginAttempts: 5 });

      const service = makeService();
      const error = await service
        .login({
          email: 'alice@example.com',
          password: 'wrong',
          ipAddress: '127.0.0.1',
        })
        .catch((e) => e);

      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.code).toBe('auth.account_locked');
      expect(userRepo.setLockedUntil).toHaveBeenCalledOnce();
    });
  });

  describe('loginComplete', () => {
    it('calls verifyOtp and returns session', async () => {
      vi.mocked(otpCodeRepo.findActiveByIdOnly).mockResolvedValue({
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
      });
      vi.mocked(userRepo.findByEmailGlobal).mockResolvedValue(makeUser());

      const service = makeService();
      const result = await service.loginComplete({
        otpId: 'otp-1',
        code: '123456',
        trustDevice: false,
      });

      expect(otpService.verifyOtp).toHaveBeenCalledOnce();
      expect(result.session.accessToken).toBe('access.token.jwt');
      expect(result.setDeviceTrustCookie).toBe(false);
    });

    it('sets device trust cookie when trustDevice=true and deviceId provided', async () => {
      vi.mocked(otpCodeRepo.findActiveByIdOnly).mockResolvedValue({
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
      });
      vi.mocked(userRepo.findByEmailGlobal).mockResolvedValue(makeUser());
      vi.mocked(deviceTrustRepo.upsert).mockResolvedValue({
        id: 'dt-1',
        userId: 'user-1',
        deviceHash: 'any-computed-hash',
        expiresAt: new Date(Date.now() + 5184000_000),
        createdAt: new Date(),
      });

      const service = makeService();
      const result = await service.loginComplete({
        otpId: 'otp-1',
        code: '123456',
        trustDevice: true,
        deviceId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.setDeviceTrustCookie).toBe(true);
      expect(result.deviceHash).toBeDefined();
      expect(deviceTrustRepo.upsert).toHaveBeenCalledOnce();
    });
  });

  describe('logout', () => {
    it('invalidates refresh token family', async () => {
      vi.mocked(refreshTokenRepo.findByHash).mockResolvedValue(makeRefreshToken());

      const service = makeService();
      await service.logout({ refreshTokenHash: 'oldhash' });

      expect(refreshTokenRepo.invalidateFamily).toHaveBeenCalledWith('family-1');
    });

    it('silently returns when token not found', async () => {
      vi.mocked(refreshTokenRepo.findByHash).mockResolvedValue(null);

      const service = makeService();
      await expect(service.logout({ refreshTokenHash: 'unknown' })).resolves.toBeUndefined();
    });
  });

  describe('refresh', () => {
    it('issues new tokens and marks old token as used', async () => {
      const oldToken = makeRefreshToken({ usedAt: undefined });
      vi.mocked(refreshTokenRepo.findByHashForUpdate).mockResolvedValue(oldToken);
      vi.mocked(userRepo.findById).mockResolvedValue(makeUser());
      vi.mocked(tenantRepo.findByUuid).mockResolvedValue(makeTenant());

      const service = makeService();
      const result = await service.refresh({ refreshTokenRaw: 'raw-refresh-token-64chars' });

      expect(refreshTokenRepo.markUsedByHash).toHaveBeenCalledOnce();
      expect(refreshTokenRepo.create).toHaveBeenCalledOnce();
      expect(result.newRawToken).toBeTruthy();
    });

    it('throws UnauthorizedError when token not found', async () => {
      vi.mocked(refreshTokenRepo.findByHashForUpdate).mockResolvedValue(null);

      const service = makeService();
      await expect(service.refresh({ refreshTokenRaw: 'unknown' })).rejects.toThrow(
        UnauthorizedError
      );
    });

    it('invalidates family and throws on replayed token', async () => {
      const usedToken = makeRefreshToken({ usedAt: new Date() });
      vi.mocked(refreshTokenRepo.findByHashForUpdate).mockResolvedValue(usedToken);

      const service = makeService();
      const error = await service
        .refresh({ refreshTokenRaw: 'raw-refresh-token-64chars' })
        .catch((e) => e);

      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error.code).toBe('auth.refresh_family_compromised');
      expect(refreshTokenRepo.invalidateFamily).toHaveBeenCalledWith('family-1');
    });

    it('throws UnauthorizedError on expired refresh token', async () => {
      const expiredToken = makeRefreshToken({
        usedAt: undefined,
        expiresAt: new Date(Date.now() - 1000),
      });
      vi.mocked(refreshTokenRepo.findByHashForUpdate).mockResolvedValue(expiredToken);

      const service = makeService();
      const error = await service
        .refresh({ refreshTokenRaw: 'raw-refresh-token-64chars' })
        .catch((e) => e);

      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error.code).toBe('auth.refresh_expired');
    });

    // ── T-006 Task 6.3: refresh ALLOWS pending_first_login (Bancard redirect) ──
    it('allows refresh for pending_first_login user', async () => {
      const oldToken = makeRefreshToken({ usedAt: undefined });
      vi.mocked(refreshTokenRepo.findByHashForUpdate).mockResolvedValue(oldToken);
      vi.mocked(userRepo.findById).mockResolvedValue(
        makeUser({ status: 'pending_first_login' }),
      );
      vi.mocked(tenantRepo.findByUuid).mockResolvedValue(makeTenant());

      const service = makeService();
      const result = await service.refresh({ refreshTokenRaw: 'raw-refresh-token-64chars' });

      expect(refreshTokenRepo.markUsedByHash).toHaveBeenCalledOnce();
      expect(result.session.accessToken).toBe('access.token.jwt');
    });
  });

  // ── T-006 Task 6.4: me() returns status ──────────────────────
  describe('me', () => {
    it('returns status field in user object', async () => {
      vi.mocked(userRepo.findById).mockResolvedValue(makeUser({ status: 'active' }));
      vi.mocked(tenantRepo.findByUuid).mockResolvedValue(makeTenant());

      const service = makeService();
      const result = await service.me('user-1');

      expect(result.user.status).toBe('active');
    });

    it('returns pending_first_login status when user has not activated', async () => {
      vi.mocked(userRepo.findById).mockResolvedValue(
        makeUser({ status: 'pending_first_login' }),
      );
      vi.mocked(tenantRepo.findByUuid).mockResolvedValue(makeTenant());

      const service = makeService();
      const result = await service.me('user-2');

      expect(result.user.status).toBe('pending_first_login');
    });
  });
});
