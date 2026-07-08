import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFirstLoginService } from './first-login.service.js';
import { ConflictError, NotFoundError, ValidationError } from '../errors.js';
import { silentLogger } from '../test-helpers/logger.js';
import type { UserRepository, RefreshTokenRepository, TenantRepository } from '../repositories/index.js';
import type { OtpService } from './otp.service.js';
import type { TokenService } from './token.service.js';
import type { PasswordService } from './password.service.js';
import type { Config } from '../config.js';
import type { User, RefreshToken, Tenant } from '../domain/index.js';

const makeUser = (overrides?: Partial<User>): User => ({
  id: 'user-1',
  tenantId: 'tenant-uuid-1',
  email: 'ana@empresa.com',
  passwordHash: undefined,
  role: 'TenantAdmin',
  fullName: undefined,
  phone: undefined,
  picture: undefined,
  status: 'pending_first_login',
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

const makeTenant = (): Tenant => ({
  id: 'tenant-uuid-1',
  slug: 'acme',
  name: 'Acme Corp',
  schemaName: 'tenant_acme',
  planId: 'plan-1',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeRefreshToken = (): RefreshToken => ({
  id: 'rt-1',
  userId: 'user-1',
  tokenHash: 'hash',
  familyId: 'family-1',
  parentId: undefined,
  usedAt: undefined,
  expiresAt: new Date(Date.now() + 604800_000),
  createdAt: new Date(),
});

function makeConfig(): Config {
  return {
    JWT_REFRESH_TOKEN_TTL_SECONDS: 604800,
  } as unknown as Config;
}

describe('FirstLoginService', () => {
  let userRepo: UserRepository;
  let refreshTokenRepo: RefreshTokenRepository;
  let tenantRepo: TenantRepository;
  let otpService: OtpService;
  let tokenService: TokenService;
  let passwordService: PasswordService;
  let config: Config;

  beforeEach(() => {
    userRepo = {
      findByEmail: vi.fn(),
      findByEmailGlobal: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn().mockResolvedValue(makeUser({ status: 'active' })),
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
    };
    refreshTokenRepo = {
      create: vi.fn().mockResolvedValue(makeRefreshToken()),
      findByHash: vi.fn(),
      findByHashForUpdate: vi.fn(),
      markUsedByHash: vi.fn(),
      invalidateFamily: vi.fn(),
      findActiveByUserId: vi.fn(),
      deleteExpired: vi.fn(),
      invalidateAllForUser: vi.fn().mockResolvedValue(undefined),
    };
    tenantRepo = {
      findBySlug: vi.fn(),
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
        maskedDestination: 'a***@empresa.com',
        expiresAt: new Date(Date.now() + 300_000),
        resendAvailableAt: new Date(Date.now() + 30_000),
      }),
      verifyOtp: vi.fn(),
    } as unknown as OtpService;
    tokenService = {
      signAccessToken: vi.fn().mockResolvedValue({
        accessToken: 'access.token.jwt',
        expiresIn: 900,
        tokenType: 'Bearer',
      }),
      signRefreshTokenRaw: vi.fn().mockReturnValue('raw-refresh-64chars'),
      verifyOtpVerificationToken: vi.fn(),
      verifyAccessToken: vi.fn(),
      getJwks: vi.fn(),
    } as unknown as TokenService;
    passwordService = {
      hashPassword: vi.fn().mockResolvedValue('$argon2id$hash'),
      verifyPassword: vi.fn(),
      validatePasswordPolicy: vi.fn(),
      requestRecovery: vi.fn(),
      completeRecovery: vi.fn(),
    } as unknown as PasswordService;
    config = makeConfig();
  });

  function makeService() {
    return createFirstLoginService({
      userRepo,
      refreshTokenRepo,
      tenantRepo,
      otpService,
      tokenService,
      passwordService,
      config,
      logger: silentLogger,
    });
  }

  describe('start', () => {
    it('sends OTP and returns SendOtpResult for pending_first_login user', async () => {
      vi.mocked(userRepo.findByEmailGlobal).mockResolvedValue(makeUser());

      const service = makeService();
      const result = await service.start({
        email: 'ana@empresa.com',
        ipAddress: '127.0.0.1',
      });

      expect(result.otpId).toBe('otp-1');
      expect(otpService.sendOtp).toHaveBeenCalledWith({
        identifier: 'ana@empresa.com',
        channel: 'email',
        purpose: 'first-login',
        ipAddress: '127.0.0.1',
      });
    });

    it('throws NotFoundError when user not found', async () => {
      vi.mocked(userRepo.findByEmailGlobal).mockResolvedValue(null);

      const service = makeService();
      await expect(
        service.start({
          email: 'unknown@empresa.com',
          ipAddress: '127.0.0.1',
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ConflictError when user is already active', async () => {
      vi.mocked(userRepo.findByEmailGlobal).mockResolvedValue(makeUser({ status: 'active' }));

      const service = makeService();
      await expect(
        service.start({ email: 'ana@empresa.com', ipAddress: '127.0.0.1' })
      ).rejects.toThrow(ConflictError);
    });

    it('throws ConflictError when user is suspended', async () => {
      vi.mocked(userRepo.findByEmailGlobal).mockResolvedValue(makeUser({ status: 'suspended' }));

      const service = makeService();
      await expect(
        service.start({ email: 'ana@empresa.com', ipAddress: '127.0.0.1' })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('setPassword', () => {
    it('activates user and returns { session, refreshTokenRaw } on valid token and password', async () => {
      vi.mocked(tokenService.verifyOtpVerificationToken).mockResolvedValue({
        sub: 'user-1',
        purpose: 'first-login',
        otpId: 'otp-1',
      });

      const service = makeService();
      const result = await service.setPassword({
        otpVerificationToken: 'valid.otp.token',
        password: 'ValidPassword!1',
      });

      expect(userRepo.setPasswordHash).toHaveBeenCalledWith('user-1', '$argon2id$hash');
      expect(userRepo.updateStatus).toHaveBeenCalledWith('user-1', 'active');
      expect(tenantRepo.findByUuid).toHaveBeenCalledWith('tenant-uuid-1');
      expect(refreshTokenRepo.create).toHaveBeenCalledOnce();
      expect(result.session.accessToken).toBe('access.token.jwt');
      expect(result.session.tokenType).toBe('Bearer');
      expect(result.refreshTokenRaw).toBe('raw-refresh-64chars');
    });

    it('throws ValidationError when OTP token purpose is not first-login', async () => {
      vi.mocked(tokenService.verifyOtpVerificationToken).mockResolvedValue({
        sub: 'user-1',
        purpose: 'login',
        otpId: 'otp-1',
      });

      const service = makeService();
      await expect(
        service.setPassword({
          otpVerificationToken: 'wrong.purpose.token',
          password: 'ValidPassword!1',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError on weak password (via validatePasswordPolicy)', async () => {
      vi.mocked(tokenService.verifyOtpVerificationToken).mockResolvedValue({
        sub: 'user-1',
        purpose: 'first-login',
        otpId: 'otp-1',
      });
      vi.mocked(passwordService.validatePasswordPolicy).mockImplementation(() => {
        throw new ValidationError('auth.password_policy_violation');
      });

      const service = makeService();
      await expect(
        service.setPassword({
          otpVerificationToken: 'valid.token',
          password: 'weak',
        })
      ).rejects.toThrow(ValidationError);
    });

    // ── T-006 Task 6.6: setPassword issues token with user_status: 'active' ──
    it('signs access token with user_status active after activation', async () => {
      vi.mocked(tokenService.verifyOtpVerificationToken).mockResolvedValue({
        sub: 'user-1',
        purpose: 'first-login',
        otpId: 'otp-1',
      });

      const service = makeService();
      await service.setPassword({
        otpVerificationToken: 'valid.otp.token',
        password: 'ValidPassword!1',
      });

      expect(tokenService.signAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({ user_status: 'active' }),
      );
    });
  });
});
