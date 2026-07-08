import argon2 from 'argon2'
import { createHash } from 'crypto'
import { nanoid } from 'nanoid'
import type { UserRepository, PasswordResetTokenRepository, RefreshTokenRepository } from '../repositories/index.js'
import type { EmailAdapter, RateLimiter } from '../adapters/index.js'
import { passwordRecoveryTemplate } from '../adapters/email/templates/index.js'
import type { TokenService } from './token.service.js'
import type { Config } from '../config.js'
import { RateLimitError, ValidationError } from '../errors.js'
import type { Logger } from '../lib/logger.js'

export type PasswordServiceDeps = {
  userRepo: UserRepository
  passwordResetTokenRepo: PasswordResetTokenRepository
  refreshTokenRepo: RefreshTokenRepository
  emailAdapter: EmailAdapter
  tokenService: TokenService
  rateLimiter: RateLimiter
  config: Config
  logger: Logger
}

const PASSWORD_POLICY = {
  minLength: 12,
  upper: /[A-Z]/,
  lower: /[a-z]/,
  digit: /[0-9]/,
  symbol: /[^A-Za-z0-9]/,
}

export function createPasswordService(deps: PasswordServiceDeps) {
  const { userRepo, passwordResetTokenRepo, refreshTokenRepo, emailAdapter, tokenService, rateLimiter, config, logger } = deps

  const log = logger.child({ component: 'password' })

  function validatePasswordPolicy(password: string): void {
    if (
      password.length < PASSWORD_POLICY.minLength ||
      !PASSWORD_POLICY.upper.test(password) ||
      !PASSWORD_POLICY.lower.test(password) ||
      !PASSWORD_POLICY.digit.test(password) ||
      !PASSWORD_POLICY.symbol.test(password)
    ) {
      throw new ValidationError('auth.password_policy_violation', undefined, [
        {
          field: 'password',
          code: 'auth.password_policy_violation',
          message:
            'Password must be at least 12 characters and contain uppercase, lowercase, digit, and symbol.',
        },
      ])
    }
  }

  async function hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id })
  }

  async function verifyPassword(plain: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, plain)
  }

  async function requestRecovery(params: {
    email: string
    ipAddress: string
  }): Promise<void> {
    const { email, ipAddress } = params

    const emailKey = `recovery:email:${email}`
    const emailWindowMs = 300 * 1000
    if (!rateLimiter.check(emailKey, 3, emailWindowMs)) {
      log.warn({ category: 'auth', event: 'password_rate_limited', email, ipAddress })
      throw new RateLimitError('auth.rate_limit_exceeded', 300)
    }

    const ipKey = `recovery:ip:${ipAddress}`
    const ipWindowMs = 3600 * 1000
    if (!rateLimiter.check(ipKey, 10, ipWindowMs)) {
      log.warn({ category: 'auth', event: 'password_rate_limited', email, ipAddress })
      throw new RateLimitError('auth.rate_limit_exceeded', 3600)
    }

    rateLimiter.increment(emailKey, emailWindowMs)
    rateLimiter.increment(ipKey, ipWindowMs)

    // findByEmailGlobal: search across all tenants — no tenantId required for recovery
    const user = await userRepo.findByEmailGlobal(email)
    if (!user) {
      return
    }

    const rawToken = nanoid(64)
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + 1800 * 1000)

    await passwordResetTokenRepo.create({ userId: user.id, tokenHash, expiresAt })

    const baseUrl = config.BANCARD_RETURN_URL.replace('/onboarding/payment/return', '')
    const resetLink = `${baseUrl}/auth/password/recover?token=${rawToken}`

    const expiresInMinutes = Math.floor(1800 / 60)
    const { subject, html } = passwordRecoveryTemplate({ resetUrl: resetLink, expiresInMinutes })

    await emailAdapter.send({ to: email, subject, html })

    log.info({ category: 'auth', event: 'password_recovery_requested', email })
  }

  async function completeRecovery(params: {
    otpVerificationToken: string
    newPassword: string
  }): Promise<void> {
    const { otpVerificationToken, newPassword } = params

    const payload = await tokenService.verifyOtpVerificationToken(otpVerificationToken)

    if (payload.purpose !== 'recover') {
      throw new ValidationError('auth.verification_token_invalid')
    }

    validatePasswordPolicy(newPassword)

    const newHash = await hashPassword(newPassword)
    await userRepo.setPasswordHash(payload.sub, newHash)

    const activeTokens = await refreshTokenRepo.findActiveByUserId(payload.sub)
    for (const token of activeTokens) {
      await refreshTokenRepo.invalidateFamily(token.familyId)
    }

    log.info({ category: 'auth', event: 'password_recovery_completed', userId: payload.sub })
  }

  return {
    hashPassword,
    verifyPassword,
    requestRecovery,
    completeRecovery,
    validatePasswordPolicy,
  }
}

export type PasswordService = ReturnType<typeof createPasswordService>
