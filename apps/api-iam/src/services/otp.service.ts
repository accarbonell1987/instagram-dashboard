import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { SignJWT } from 'jose';
import { nanoid } from 'nanoid';
import type { OtpCodeRepository, UserRepository } from '../repositories/index.js';
import type { OtpAdapter, KeyProvider, RateLimiter } from '../adapters/index.js';
import type { Config } from '../config.js';
import type { OtpChannel, OtpPurpose } from '../domain/index.js';
import { GoneError, NotFoundError, RateLimitError, ValidationError } from '../errors.js';
import type { Logger } from '../lib/logger.js';

export type OtpServiceDeps = {
  otpCodeRepo: OtpCodeRepository;
  userRepo: UserRepository;
  otpAdapter: OtpAdapter;
  rateLimiter: RateLimiter;
  config: Config;
  logger: Logger;
};

export type SendOtpParams = {
  identifier: string;
  channel: OtpChannel;
  purpose: OtpPurpose;
  ipAddress: string;
};

export type SendOtpResult = {
  otpId: string;
  channel: OtpChannel;
  maskedDestination: string;
  expiresAt: Date;
  resendAvailableAt: Date;
};

export type VerifyOtpParams = {
  otpId: string;
  code: string;
  keyProvider: KeyProvider;
  config: Config;
};

export type VerifyOtpResult = {
  verificationToken: string;
  userId: string;
  purpose: OtpPurpose;
  identifier: string;
};

function maskIdentifier(identifier: string): string {
  const atIndex = identifier.indexOf('@');
  if (atIndex > 0) {
    return identifier[0] + '***' + identifier.slice(atIndex);
  }
  if (identifier.length > 4) {
    return identifier.slice(0, 2) + '***' + identifier.slice(-2);
  }
  return '***';
}

export function createOtpService(deps: OtpServiceDeps) {
  const { otpCodeRepo, userRepo, otpAdapter, rateLimiter, config, logger } = deps;

  const log = logger.child({ component: 'otp' });

  async function sendOtp(params: SendOtpParams): Promise<SendOtpResult> {
    const { identifier, channel, purpose, ipAddress } = params;

    if (!config.OTP_STUB_CODE) {
      const identifierKey30s = `otp:id:${identifier}:30s`;
      const identifierWindow30sMs = 30 * 1000;
      if (!rateLimiter.check(identifierKey30s, 1, identifierWindow30sMs)) {
        const retryAfter = config.OTP_RESEND_COOLDOWN_SECONDS;
        log.warn({ category: 'otp', event: 'otp_rate_limited', identifier, ipAddress });
        throw new RateLimitError('auth.rate_limit_exceeded', retryAfter);
      }

      const identifierKey1h = `otp:id:${identifier}:3600s`;
      const identifierWindow1hMs = 3600 * 1000;
      if (!rateLimiter.check(identifierKey1h, 5, identifierWindow1hMs)) {
        log.warn({ category: 'otp', event: 'otp_rate_limited', identifier, ipAddress });
        throw new RateLimitError('auth.rate_limit_exceeded', 3600);
      }

      const ipKey = `otp:ip:${ipAddress}:10s`;
      const ipWindowMs = 10 * 1000;
      if (!rateLimiter.check(ipKey, 1, ipWindowMs)) {
        log.warn({ category: 'otp', event: 'otp_rate_limited', identifier, ipAddress });
        throw new RateLimitError('auth.rate_limit_exceeded_ip', 10);
      }

      rateLimiter.increment(identifierKey30s, identifierWindow30sMs);
      rateLimiter.increment(identifierKey1h, identifierWindow1hMs);
      rateLimiter.increment(ipKey, ipWindowMs);
    }

    const code = config.OTP_STUB_CODE ?? randomInt(100000, 1000000).toString();
    const codeHash = await bcrypt.hash(code, 6);
    const expiresAt = new Date(Date.now() + config.OTP_TTL_SECONDS * 1000);

    const otpCode = await otpCodeRepo.create({
      identifier,
      channel,
      purpose,
      codeHash,
      expiresAt,
    });

    await otpAdapter.send({
      identifier,
      channel,
      code,
      purpose,
      ttlSeconds: config.OTP_TTL_SECONDS,
    });

    const resendAvailableAt = new Date(Date.now() + config.OTP_RESEND_COOLDOWN_SECONDS * 1000);

    log.info({ category: 'otp', event: 'otp_sent', otpId: otpCode.id, purpose, channel, identifier });

    return {
      otpId: otpCode.id,
      channel,
      maskedDestination: maskIdentifier(identifier),
      expiresAt,
      resendAvailableAt,
    };
  }

  async function verifyOtp(params: VerifyOtpParams): Promise<VerifyOtpResult> {
    const { otpId, code, keyProvider, config: verifyConfig } = params;

    const otp = await otpCodeRepo.findActiveByIdOnly(otpId);
    if (!otp) {
      throw new GoneError('auth.otp_expired');
    }

    const { identifier, purpose } = otp;

    // Derive userId from OTP record: look up user by identifier (email)
    const user = await userRepo.findByEmailGlobal(identifier);
    if (!user) {
      throw new NotFoundError('auth.user_not_found');
    }
    const userId = user.id;

    if (otp.lockedUntil && otp.lockedUntil > new Date()) {
      throw new RateLimitError(
        'auth.otp_locked',
        Math.ceil((otp.lockedUntil.getTime() - Date.now()) / 1000)
      );
    }

    const isValid = await bcrypt.compare(code, otp.codeHash);

    if (!isValid) {
      const updatedOtp = await otpCodeRepo.incrementAttempts(otpId);
      const newAttempts = updatedOtp.attempts;

      if (newAttempts >= verifyConfig.OTP_MAX_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + verifyConfig.OTP_LOCKOUT_SECONDS * 1000);
        await otpCodeRepo.lockUntil(otpId, lockedUntil);
        log.warn({ category: 'otp', event: 'otp_locked', otpId });
        throw new RateLimitError('auth.otp_locked', verifyConfig.OTP_LOCKOUT_SECONDS);
      }

      log.warn({ category: 'otp', event: 'otp_verify_failed', otpId, attempts: newAttempts });
      const attemptsRemaining = verifyConfig.OTP_MAX_ATTEMPTS - newAttempts;
      throw new ValidationError('auth.otp_invalid', undefined, [
        {
          field: 'code',
          code: 'auth.otp_invalid',
          message: `Código OTP inválido. Te quedan ${attemptsRemaining} intentos.`,
        },
      ]);
    }

    await otpCodeRepo.markUsed(otpId);
    log.info({ category: 'otp', event: 'otp_verified', otpId, purpose });

    const { privateKey, kid } = await keyProvider.getSigningKey();
    const now = Math.floor(Date.now() / 1000);
    const otpVerificationToken = await new SignJWT({
      purpose,
      otpId,
      jti: nanoid(),
    })
      .setProtectedHeader({ alg: 'RS256', kid })
      .setSubject(userId)
      .setAudience(verifyConfig.JWT_OTP_VERIFICATION_AUDIENCE)
      .setIssuer(verifyConfig.JWT_ISSUER)
      .setIssuedAt(now)
      .setExpirationTime(now + verifyConfig.JWT_OTP_VERIFICATION_TTL_SECONDS)
      .sign(privateKey);

    return { verificationToken: otpVerificationToken, userId, purpose, identifier };
  }

  // Verifies the OTP code and marks it as used, without looking up the user or issuing a JWT.
  // Used for flows where the user does not exist yet at verification time (e.g. signup-rep).
  async function verifyOtpCodeOnly(
    otpId: string,
    code: string
  ): Promise<{ identifier: string; purpose: OtpPurpose }> {
    const otp = await otpCodeRepo.findActiveByIdOnly(otpId);
    if (!otp) {
      throw new GoneError('auth.otp_expired');
    }

    const { identifier, purpose } = otp;

    if (otp.lockedUntil && otp.lockedUntil > new Date()) {
      throw new RateLimitError(
        'auth.otp_locked',
        Math.ceil((otp.lockedUntil.getTime() - Date.now()) / 1000)
      );
    }

    const isValid = await bcrypt.compare(code, otp.codeHash);

    if (!isValid) {
      const updatedOtp = await otpCodeRepo.incrementAttempts(otpId);
      const newAttempts = updatedOtp.attempts;

      if (newAttempts >= config.OTP_MAX_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + config.OTP_LOCKOUT_SECONDS * 1000);
        await otpCodeRepo.lockUntil(otpId, lockedUntil);
        log.warn({ category: 'otp', event: 'otp_locked', otpId });
        throw new RateLimitError('auth.otp_locked', config.OTP_LOCKOUT_SECONDS);
      }

      log.warn({ category: 'otp', event: 'otp_verify_failed', otpId, attempts: newAttempts });
      const attemptsRemaining = config.OTP_MAX_ATTEMPTS - newAttempts;
      throw new ValidationError('auth.otp_invalid', undefined, [
        {
          field: 'code',
          code: 'auth.otp_invalid',
          message: `Código OTP inválido. Te quedan ${attemptsRemaining} intentos.`,
        },
      ]);
    }

    await otpCodeRepo.markUsed(otpId);
    log.info({ category: 'otp', event: 'otp_verified', otpId, purpose });

    return { identifier, purpose };
  }

  async function lookupPurpose(
    otpId: string
  ): Promise<{ purpose: OtpPurpose; identifier: string }> {
    const otp = await otpCodeRepo.findActiveByIdOnly(otpId);
    if (!otp) {
      throw new GoneError('auth.otp_expired');
    }
    return { purpose: otp.purpose, identifier: otp.identifier };
  }

  return { sendOtp, verifyOtp, verifyOtpCodeOnly, lookupPurpose };
}

export type OtpService = ReturnType<typeof createOtpService>;
