import { nanoid } from 'nanoid';
import { createHash } from 'crypto';
import type { UserRepository, RefreshTokenRepository, TenantRepository } from '../repositories/index.js';
import type { OtpService, SendOtpResult } from './otp.service.js';
import type { TokenService } from './token.service.js';
import type { PasswordService } from './password.service.js';
import type { Config } from '../config.js';
import type { Session } from '../domain/index.js';
import { ConflictError, GoneError, NotFoundError, ValidationError } from '../errors.js';
import type { Logger } from '../lib/logger.js';

export type FirstLoginServiceDeps = {
  userRepo: UserRepository;
  refreshTokenRepo: RefreshTokenRepository;
  tenantRepo: TenantRepository;
  otpService: OtpService;
  tokenService: TokenService;
  passwordService: PasswordService;
  config: Config;
  logger: Logger;
};

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function createFirstLoginService(deps: FirstLoginServiceDeps) {
  const { userRepo, refreshTokenRepo, tenantRepo, otpService, tokenService, passwordService, config, logger } = deps;

  const log = logger.child({ component: 'first-login' });

  async function start(params: {
    email: string;
    ipAddress: string;
  }): Promise<SendOtpResult> {
    const { email, ipAddress } = params;

    const user = await userRepo.findByEmailGlobal(email);
    if (!user) {
      throw new NotFoundError('auth.user_not_found');
    }

    if (user.status !== 'pending_first_login') {
      throw new ConflictError('auth.account_already_active');
    }

    return otpService.sendOtp({
      identifier: email,
      channel: 'email',
      purpose: 'first-login',
      ipAddress,
    });
  }

  async function setPassword(params: {
    otpVerificationToken: string;
    password: string;
  }): Promise<{ session: Session; refreshTokenRaw: string }> {
    const { otpVerificationToken, password } = params;

    const tokenPayload = await tokenService.verifyOtpVerificationToken(otpVerificationToken);

    if (tokenPayload.purpose !== 'first-login') {
      throw new ValidationError('auth.verification_token_invalid');
    }

    passwordService.validatePasswordPolicy(password);

    const passwordHash = await passwordService.hashPassword(password);
    await userRepo.setPasswordHash(tokenPayload.sub, passwordHash);

    // Atomically mark activation token as used (in same logical flow)
    await userRepo.setActivationTokenUsed(tokenPayload.sub);

    const user = await userRepo.updateStatus(tokenPayload.sub, 'active');

    // Resolve tenant from DB using the user's tenantId
    const tenant = await tenantRepo.findByUuid(user.tenantId);

    const tokenResult = await tokenService.signAccessToken({
      sub: user.id,
      email: user.email,
      name: user.fullName ?? '',
      tenantId: tenant.slug,
      tenantUuid: tenant.id,
      role: user.role,
      user_status: 'active',
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

    log.info({ category: 'auth', event: 'first_login_completed', userId: user.id, tenantId: tenant.id });

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

  async function validateActivationToken(rawToken: string): Promise<{
    email: string;
    fullName: string;
    tenantName: string;
  }> {
    const tokenHash = hashToken(rawToken);
    const user = await userRepo.findByActivationTokenHash(tokenHash);

    if (!user) {
      throw new NotFoundError('auth.token_not_found');
    }

    if (user.activationTokenUsed) {
      throw new GoneError('auth.token_already_used');
    }

    if (!user.activationTokenExpiresAt || user.activationTokenExpiresAt < new Date()) {
      throw new GoneError('auth.token_expired');
    }

    const tenant = await tenantRepo.findByUuid(user.tenantId);

    return {
      email: user.email,
      fullName: user.fullName ?? '',
      tenantName: tenant.name,
    };
  }

  return { start, setPassword, validateActivationToken };
}

export type FirstLoginService = ReturnType<typeof createFirstLoginService>;
