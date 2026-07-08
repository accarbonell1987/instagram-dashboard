import argon2 from 'argon2';
import { createHash } from 'crypto';
import { nanoid } from 'nanoid';
import type { PrismaClient } from '../generated/prisma/client.js';
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
import type { Session, User, Tenant, UserRole, UserStatus, TenantStatus } from '../domain/index.js';
import { ForbiddenError, NotFoundError, RateLimitError, UnauthorizedError } from '../errors.js';
import type { Logger } from '../lib/logger.js';

export type AuthServiceDeps = {
  userRepo: UserRepository;
  refreshTokenRepo: RefreshTokenRepository;
  deviceTrustRepo: DeviceTrustRepository;
  tenantRepo: TenantRepository;
  otpCodeRepo: OtpCodeRepository;
  otpService: OtpService;
  tokenService: TokenService;
  keyProvider: KeyProvider;
  config: Config;
  prisma: PrismaClient;
  logger: Logger;
};

export type LoginResult =
  | {
      otpRequired: true;
      otpId: string;
      channel: string;
      maskedDestination: string;
      expiresAt: Date;
      resendAvailableAt: Date;
    }
  | {
      otpRequired: false;
      session: Session;
      refreshTokenRaw: string;
    };

export type LoginCompleteResult = {
  session: Session;
  refreshTokenRaw: string;
  setDeviceTrustCookie: boolean;
  deviceHash?: string | undefined;
};

export type RefreshResult = {
  newRawToken: string;
  session: Session;
};

export type MeResult = {
  user: {
    id: string;
    email: string;
    fullName: string;
    picture: string | undefined;
    role: UserRole;
    status: UserStatus;
  };
  tenant: {
    id: string;
    slug: string;
    name: string;
    planId: string;
    status: TenantStatus;
  };
  role: UserRole;
};

export function createAuthService(deps: AuthServiceDeps) {
  const {
    userRepo,
    refreshTokenRepo,
    deviceTrustRepo,
    tenantRepo,
    otpCodeRepo,
    otpService,
    tokenService,
    keyProvider,
    config,
    prisma,
    logger,
  } = deps;

  const log = logger.child({ component: 'auth' });

  function hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Computes a stable device hash from a client-provided UUID and the user ID.
   * SHA-256("${deviceId}:${userId}") — 64-char hex string.
   * The client generates the UUID (localStorage 'hub_device_id') and sends it in the body.
   */
  function computeDeviceHash(deviceId: string, userId: string): string {
    return createHash('sha256').update(`${deviceId}:${userId}`).digest('hex');
  }

  async function _issueSession(
    user: User,
    tenant: Tenant
  ): Promise<{ session: Session; refreshTokenRaw: string }> {
    const tokenResult = await tokenService.signAccessToken({
      sub: user.id,
      email: user.email,
      name: user.fullName ?? '',
      tenantId: tenant.slug,
      tenantUuid: tenant.id,
      role: user.role,
      user_status: user.status,
    });

    const rawRefreshToken = tokenService.signRefreshTokenRaw();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + config.JWT_REFRESH_TOKEN_TTL_SECONDS * 1000);
    const familyId = nanoid();

    await refreshTokenRepo.create({
      userId: user.id,
      tokenHash,
      familyId,
      expiresAt,
    });

    const session: Session = {
      accessToken: tokenResult.accessToken,
      expiresIn: tokenResult.expiresIn,
      tokenType: 'Bearer',
      role: user.role,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName ?? '',
        picture: user.picture ?? undefined,
        role: user.role,
        status: user.status,
      },
      tenant: {
        id: tenant.slug,
        slug: tenant.slug,
        name: tenant.name,
        planId: tenant.planId,
        status: tenant.status,
      },
    };

    return { session, refreshTokenRaw: rawRefreshToken };
  }

  async function login(params: {
    email: string;
    password: string;
    deviceId?: string | undefined;
    ipAddress: string;
  }): Promise<LoginResult> {
    const { email, password, deviceId, ipAddress } = params;

    // Find user by email first (tenantSlug no longer in request)
    const user = await userRepo.findByEmailGlobal(email);
    if (!user) {
      log.warn({ category: 'auth', event: 'login_failed', email, reason: 'user_not_found' });
      throw new UnauthorizedError('auth.invalid_credentials');
    }

    // Derive tenant from user
    const tenant = await tenantRepo.findByUuid(user.tenantId);

    if (user.status === 'suspended') {
      throw new ForbiddenError('auth.account_suspended');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const retryAfter = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
      throw new RateLimitError('auth.account_locked', retryAfter);
    }

    if (!user.passwordHash) {
      throw new UnauthorizedError('auth.invalid_credentials');
    }

    const passwordValid = await argon2.verify(user.passwordHash, password);

    if (!passwordValid) {
      log.warn({ category: 'auth', event: 'login_failed', email, reason: 'invalid_password' });
      const { failedLoginAttempts: newAttempts } = await userRepo.incrementFailedAttempts(user.id);

      if (newAttempts >= 5) {
        const lockUntil = new Date(Date.now() + 900 * 1000);
        await userRepo.setLockedUntil(user.id, lockUntil);
        throw new RateLimitError('auth.account_locked', 900);
      }

      throw new UnauthorizedError('auth.invalid_credentials');
    }

    await userRepo.resetFailedAttempts(user.id);

    // Reject pending_first_login users — they must complete first-login flow first.
    // Check AFTER password verification so wrong passwords still return 401 (no enumeration).
    if (user.status === 'pending_first_login') {
      throw new ForbiddenError('auth.account_pending_activation',
        'Account pending activation. Complete first-login flow.');
    }

    if (deviceId) {
      const deviceHash = computeDeviceHash(deviceId, user.id);
      const trust = await deviceTrustRepo.findByUserAndHash(user.id, deviceHash);
      if (trust && trust.expiresAt > new Date()) {
        const { session, refreshTokenRaw } = await _issueSession(user, tenant);
        log.info({ category: 'auth', event: 'login_success', userId: user.id, tenantId: tenant.id, method: 'device_trust' });
        return { otpRequired: false, session, refreshTokenRaw };
      }
    }

    const otpResult = await otpService.sendOtp({
      identifier: email,
      channel: 'email',
      purpose: 'login',
      ipAddress,
    });

    log.info({ category: 'auth', event: 'otp_required', userId: user.id, tenantId: tenant.id, channel: otpResult.channel });

    return {
      otpRequired: true,
      otpId: otpResult.otpId,
      channel: otpResult.channel,
      maskedDestination: otpResult.maskedDestination,
      expiresAt: otpResult.expiresAt,
      resendAvailableAt: otpResult.resendAvailableAt,
    };
  }

  async function loginComplete(params: {
    otpId: string;
    code: string;
    trustDevice: boolean;
    deviceId?: string | undefined;
  }): Promise<LoginCompleteResult> {
    const { otpId, code, trustDevice, deviceId } = params;

    // Look up OTP to get identifier (email) — used to find the user
    const otp = await otpCodeRepo.findActiveByIdOnly(otpId);
    if (!otp) {
      throw new UnauthorizedError('auth.otp_expired');
    }

    // Derive user from OTP identifier (email)
    const user = await userRepo.findByEmailGlobal(otp.identifier);
    if (!user) {
      throw new NotFoundError('auth.user_not_found');
    }

    // Derive tenant from user
    const tenant = await tenantRepo.findByUuid(user.tenantId);

    await otpService.verifyOtp({
      otpId,
      code,
      keyProvider,
      config,
    });

    let setDeviceTrustCookie = false;
    let storedDeviceHash: string | undefined;

    if (trustDevice && deviceId) {
      const deviceHash = computeDeviceHash(deviceId, user.id);
      const expiresAt = new Date(Date.now() + config.DEVICE_TRUST_TTL_SECONDS * 1000);
      await deviceTrustRepo.upsert({ userId: user.id, deviceHash, expiresAt });
      setDeviceTrustCookie = true;
      storedDeviceHash = deviceHash;
      log.info({ category: 'auth', event: 'device_trust_registered', userId: user.id });
    }

    const { session, refreshTokenRaw } = await _issueSession(user, tenant);

    log.info({ category: 'auth', event: 'session_issued', userId: user.id, tenantId: tenant.id });

    return { session, refreshTokenRaw, setDeviceTrustCookie, deviceHash: storedDeviceHash };
  }

  async function me(userId: string): Promise<MeResult> {
    const user = await userRepo.findById(userId);
    const tenant = await tenantRepo.findByUuid(user.tenantId);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName ?? '',
        picture: user.picture ?? undefined,
        role: user.role,
        status: user.status,
      },
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        planId: tenant.planId,
        status: tenant.status,
      },
      role: user.role,
    };
  }

  async function logout(params: { refreshTokenHash: string }): Promise<void> {
    const token = await refreshTokenRepo.findByHash(params.refreshTokenHash);
    if (!token) {
      return;
    }
    await refreshTokenRepo.invalidateFamily(token.familyId);
    log.info({ category: 'auth', event: 'logout', userId: token.userId, tenantId: undefined });
  }

  async function refresh(params: { refreshTokenRaw: string }): Promise<RefreshResult> {
    const { refreshTokenRaw } = params;
    const oldHash = hashToken(refreshTokenRaw);

    // Phase 1: within a transaction — only the refresh token rotation needs atomicity.
    // Lock the old token row FOR UPDATE, validate, mark as used, and create the
    // successor token. User/tenant lookups and JWT signing happen outside (Phase 2)
    // to keep the transaction short and avoid Prisma's 5000 ms interactive timeout.
    //
    // IMPORTANT: All DB writes inside the callback MUST use the transaction client (tx),
    // NOT this.prisma. Using this.prisma blocks on the FOR UPDATE row lock held by tx.
    const { userId, newRawToken } = await prisma.$transaction(async (tx) => {
      const oldToken = await refreshTokenRepo.findByHashForUpdate(oldHash, tx);

      if (!oldToken) {
        throw new UnauthorizedError('auth.refresh_invalid');
      }

      if (oldToken.usedAt !== undefined) {
        log.error({ category: 'auth', event: 'refresh_reuse', tokenFamilyId: oldToken.familyId });
        await refreshTokenRepo.invalidateFamily(oldToken.familyId);
        throw new UnauthorizedError('auth.refresh_family_compromised');
      }

      if (oldToken.expiresAt < new Date()) {
        throw new UnauthorizedError('auth.refresh_expired');
      }

      // Use repo methods with tx so they participate in the same transaction.
      // Without tx they would use this.prisma and deadlock on the FOR UPDATE row lock.
      await refreshTokenRepo.markUsedByHash(oldHash, tx);

      const rawToken = tokenService.signRefreshTokenRaw();
      const hash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + config.JWT_REFRESH_TOKEN_TTL_SECONDS * 1000);

      await refreshTokenRepo.create({
        userId: oldToken.userId,
        tokenHash: hash,
        familyId: oldToken.familyId,
        expiresAt,
        parentId: oldToken.id,
      }, tx);

      return { userId: oldToken.userId, newRawToken: rawToken };
    });

    // Phase 2: outside the transaction — user/tenant lookups and JWT signing.
    // These are pure reads or CPU work that don't need to hold the row lock.
    const user = await userRepo.findById(userId);

    if (user.deletedAt !== undefined) {
      throw new UnauthorizedError('auth.account_deleted');
    }
    if (user.status === 'suspended') {
      throw new UnauthorizedError('auth.account_suspended');
    }
    // NOTE: pending_first_login users ARE allowed to refresh.
    // After the Bancard stub full-page redirect during first-login,
    // the user needs a valid token to download documents and complete setup.
    // Status enforcement happens at login(), not here.

    const tenant = await tenantRepo.findByUuid(user.tenantId);

    const tokenResult = await tokenService.signAccessToken({
      sub: user.id,
      email: user.email,
      name: user.fullName ?? '',
      tenantId: tenant.slug,
      tenantUuid: tenant.id,
      role: user.role,
      user_status: user.status,
    });

    const session: Session = {
      accessToken: tokenResult.accessToken,
      expiresIn: tokenResult.expiresIn,
      tokenType: 'Bearer',
      role: user.role,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName ?? '',
        picture: user.picture ?? undefined,
        role: user.role,
        status: user.status,
      },
      tenant: {
        id: tenant.slug,
        slug: tenant.slug,
        name: tenant.name,
        planId: tenant.planId,
        status: tenant.status,
      },
    };

    log.info({
      category: 'auth',
      event: 'session_refreshed',
      userId,
      tenantId: tenant.slug,
    });

    return { session, newRawToken };
  }

  return { login, loginComplete, me, logout, refresh };
}

export type AuthService = ReturnType<typeof createAuthService>;
