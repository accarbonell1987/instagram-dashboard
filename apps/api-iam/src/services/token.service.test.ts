import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateKeyPair, exportJWK } from 'jose'
import { createTokenService } from './token.service.js'
import { UnauthorizedError, GoneError, ValidationError } from '../errors.js'
import type { KeyProvider } from '../adapters/index.js'
import type { Config } from '../config.js'

const TEST_ISSUER = 'https://iam.corehub.com'
const TEST_AUDIENCE = 'corehub-hub'
const TEST_OTP_AUD = 'otp-verification'
const TEST_KID = 'test-kid-1'

async function makeKeyPair() {
  return generateKeyPair('RS256')
}

function makeConfig(overrides?: Partial<Config>): Config {
  return {
    PORT: 8080,
    NODE_ENV: 'test',
    CORS_ALLOWED_ORIGINS: ['http://localhost:3001'],
    DATABASE_URL: 'postgresql://test',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
    JWT_ACTIVE_KID: TEST_KID,
    JWT_ACCESS_TOKEN_TTL_SECONDS: 900,
    JWT_REFRESH_TOKEN_TTL_SECONDS: 604800,
    JWT_ISSUER: TEST_ISSUER,
    JWT_AUDIENCE: TEST_AUDIENCE,
    JWT_OTP_VERIFICATION_AUDIENCE: TEST_OTP_AUD,
    JWT_OTP_VERIFICATION_TTL_SECONDS: 300,
    OTP_EMAIL_PROVIDER: 'stub',
    OTP_TTL_SECONDS: 300,
    OTP_MAX_ATTEMPTS: 5,
    OTP_LOCKOUT_SECONDS: 900,
    OTP_RESEND_COOLDOWN_SECONDS: 30,
    EMAIL_PROVIDER: 'stub',
    EMAIL_FROM: 'no-reply@corehub.com',
    BANCARD_PROVIDER: 'stub',
    BANCARD_API_URL: 'https://vpos.infonet.com.py',
    BANCARD_WEBHOOK_SECRET: 'supersecretwebhookkey',
    BANCARD_RETURN_URL: 'http://localhost:3001/onboarding/payment/return',
    BANCARD_SHOP_PROCESS_PREFIX: 'corehub',
    PDF_PROVIDER: 'stub',
    STORAGE_PROVIDER: 'stub',
    STORAGE_STUB_DIR: '/tmp/iam-storage',
    IDEMPOTENCY_TTL_SECONDS: 86400,
    DEVICE_TRUST_TTL_SECONDS: 5184000,
    DRAFT_TTL_SECONDS: 604800,
    RESUME_TOKEN_TTL_SECONDS: 604800,
    RESERVED_TENANT_SLUGS: ['admin', 'www'],
    SUPERADMIN_EMAIL: 'admin@corehub.com',
    SUPERADMIN_PASSWORD: 'Change-me!',
    ...overrides,
  } as unknown as Config
}

describe('TokenService', () => {
  let keyProvider: KeyProvider
  let config: Config

  beforeEach(async () => {
    const pair = await makeKeyPair()

    keyProvider = {
      getSigningKey: vi.fn().mockResolvedValue({ privateKey: pair.privateKey, kid: TEST_KID }),
      getVerifyingKeys: vi.fn().mockResolvedValue([{ publicKey: pair.publicKey, kid: TEST_KID }]),
      getJwks: vi.fn().mockResolvedValue({ keys: [] }),
    }
    config = makeConfig()
  })

  describe('signAccessToken', () => {
    it('returns a signed JWT with all required claims', async () => {
      const service = createTokenService({ keyProvider, config })
      const result = await service.signAccessToken({
        sub: 'user-1',
        email: 'test@test.com',
        name: 'Test User',
        tenantId: 'acme',
        tenantUuid: 'uuid-1',
        role: 'TenantAdmin',
        user_status: 'active',
      })

      expect(result.tokenType).toBe('Bearer')
      expect(result.expiresIn).toBe(900)
      expect(result.accessToken).toBeTruthy()
    })

    it('encodes correct claims in the JWT payload', async () => {
      const { jwtVerify } = await import('jose')
      const pair = await makeKeyPair()
      const kp: KeyProvider = {
        getSigningKey: vi.fn().mockResolvedValue({ privateKey: pair.privateKey, kid: TEST_KID }),
        getVerifyingKeys: vi.fn().mockResolvedValue([{ publicKey: pair.publicKey, kid: TEST_KID }]),
        getJwks: vi.fn().mockResolvedValue({ keys: [] }),
      }
      const service = createTokenService({ keyProvider: kp, config })
      const { accessToken } = await service.signAccessToken({
        sub: 'user-42',
        email: 'user@test.com',
        name: 'User 42',
        tenantId: 'acme',
        tenantUuid: 'uuid-42',
        role: 'User',
        user_status: 'active',
      })

      const { payload } = await jwtVerify(accessToken, pair.publicKey, {
        issuer: TEST_ISSUER,
        audience: TEST_AUDIENCE,
      })

      expect(payload.sub).toBe('user-42')
      expect(payload['tenant_id']).toBe('acme')
      expect(payload['tenant_uuid']).toBe('uuid-42')
      expect(payload['tenant_slug']).toBe('acme')
      expect(payload['role']).toBe('User')
      expect(payload['user_status']).toBe('active')
      expect(payload['jti']).toBeTruthy()
      expect(payload['kid']).toBe(TEST_KID)
      expect(payload.iss).toBe(TEST_ISSUER)
      expect(payload.aud).toBe(TEST_AUDIENCE)
      expect(payload.exp).toBeTruthy()
      expect(payload.iat).toBeTruthy()
    })

    // ── T-006 Task 6.1: user_status claim in JWT ──────────────────
    it('includes user_status claim in JWT payload', async () => {
      const { jwtVerify } = await import('jose')
      const pair = await makeKeyPair()
      const kp: KeyProvider = {
        getSigningKey: vi.fn().mockResolvedValue({ privateKey: pair.privateKey, kid: TEST_KID }),
        getVerifyingKeys: vi.fn().mockResolvedValue([{ publicKey: pair.publicKey, kid: TEST_KID }]),
        getJwks: vi.fn().mockResolvedValue({ keys: [] }),
      }
      const service = createTokenService({ keyProvider: kp, config })
      const { accessToken } = await service.signAccessToken({
        sub: 'user-1',
        email: 'test@test.com',
        name: 'Test',
        tenantId: 'acme',
        tenantUuid: 'uuid-1',
        role: 'User',
        user_status: 'pending_first_login',
      })

      const { payload } = await jwtVerify(accessToken, pair.publicKey, {
        issuer: TEST_ISSUER,
        audience: TEST_AUDIENCE,
      })

      expect(payload['user_status']).toBe('pending_first_login')
    })

    it('emits suspended user_status correctly', async () => {
      const { jwtVerify } = await import('jose')
      const pair = await makeKeyPair()
      const kp: KeyProvider = {
        getSigningKey: vi.fn().mockResolvedValue({ privateKey: pair.privateKey, kid: TEST_KID }),
        getVerifyingKeys: vi.fn().mockResolvedValue([{ publicKey: pair.publicKey, kid: TEST_KID }]),
        getJwks: vi.fn().mockResolvedValue({ keys: [] }),
      }
      const service = createTokenService({ keyProvider: kp, config })
      const { accessToken } = await service.signAccessToken({
        sub: 'user-3',
        email: 'suspended@test.com',
        name: 'Suspended',
        tenantId: 'acme',
        tenantUuid: 'uuid-3',
        role: 'User',
        user_status: 'suspended',
      })

      const { payload } = await jwtVerify(accessToken, pair.publicKey, {
        issuer: TEST_ISSUER,
        audience: TEST_AUDIENCE,
      })

      expect(payload['user_status']).toBe('suspended')
    })
  })

  describe('verifyAccessToken', () => {
    it('succeeds on a valid token', async () => {
      const pair = await makeKeyPair()
      const kp: KeyProvider = {
        getSigningKey: vi.fn().mockResolvedValue({ privateKey: pair.privateKey, kid: TEST_KID }),
        getVerifyingKeys: vi.fn().mockResolvedValue([{ publicKey: pair.publicKey, kid: TEST_KID }]),
        getJwks: vi.fn().mockResolvedValue({ keys: [] }),
      }
      const service = createTokenService({ keyProvider: kp, config })
      const { accessToken } = await service.signAccessToken({
        sub: 'user-1',
        email: 'user@test.com',
        name: 'User',
        tenantId: 'acme',
        tenantUuid: 'uuid-1',
        role: 'User',
        user_status: 'active',
      })

      const claims = await service.verifyAccessToken(accessToken)
      expect(claims.sub).toBe('user-1')
    })

    it('throws UnauthorizedError on expired token', async () => {
      const service = createTokenService({
        keyProvider,
        config: makeConfig({ JWT_ACCESS_TOKEN_TTL_SECONDS: -1 }),
      })
      const { accessToken } = await service.signAccessToken({
        sub: 'user-1',
        email: 'user@test.com',
        name: 'User',
        tenantId: 'acme',
        tenantUuid: 'uuid-1',
        role: 'User',
        user_status: 'active',
      })

      await expect(service.verifyAccessToken(accessToken)).rejects.toThrow(UnauthorizedError)
    })

    it('throws UnauthorizedError on invalid token', async () => {
      const service = createTokenService({ keyProvider, config })
      await expect(service.verifyAccessToken('not.a.jwt')).rejects.toThrow(UnauthorizedError)
    })
  })

  describe('signRefreshTokenRaw', () => {
    it('returns a string of length 64', () => {
      const service = createTokenService({ keyProvider, config })
      const token = service.signRefreshTokenRaw()
      expect(typeof token).toBe('string')
      expect(token.length).toBe(64)
    })

    it('generates unique tokens each call', () => {
      const service = createTokenService({ keyProvider, config })
      const t1 = service.signRefreshTokenRaw()
      const t2 = service.signRefreshTokenRaw()
      expect(t1).not.toBe(t2)
    })
  })

  describe('verifyOtpVerificationToken', () => {
    it('round-trips correctly for a valid token', async () => {
      const pair = await makeKeyPair()
      const kp: KeyProvider = {
        getSigningKey: vi.fn().mockResolvedValue({ privateKey: pair.privateKey, kid: TEST_KID }),
        getVerifyingKeys: vi.fn().mockResolvedValue([{ publicKey: pair.publicKey, kid: TEST_KID }]),
        getJwks: vi.fn().mockResolvedValue({ keys: [] }),
      }
      const service = createTokenService({ keyProvider: kp, config })

      const { SignJWT } = await import('jose')
      const now = Math.floor(Date.now() / 1000)
      const otpToken = await new SignJWT({ purpose: 'login', otpId: 'otp-1', jti: 'jti-1' })
        .setProtectedHeader({ alg: 'RS256', kid: TEST_KID })
        .setSubject('user-1')
        .setIssuer(TEST_ISSUER)
        .setAudience(TEST_OTP_AUD)
        .setIssuedAt(now)
        .setExpirationTime(now + 300)
        .sign(pair.privateKey)

      const payload = await service.verifyOtpVerificationToken(otpToken)
      expect(payload.sub).toBe('user-1')
      expect(payload.purpose).toBe('login')
      expect(payload.otpId).toBe('otp-1')
    })

    it('throws GoneError on expired OTP verification token', async () => {
      const pair = await makeKeyPair()
      const kp: KeyProvider = {
        getSigningKey: vi.fn().mockResolvedValue({ privateKey: pair.privateKey, kid: TEST_KID }),
        getVerifyingKeys: vi.fn().mockResolvedValue([{ publicKey: pair.publicKey, kid: TEST_KID }]),
        getJwks: vi.fn().mockResolvedValue({ keys: [] }),
      }
      const service = createTokenService({ keyProvider: kp, config })

      const { SignJWT } = await import('jose')
      const now = Math.floor(Date.now() / 1000)
      const otpToken = await new SignJWT({ purpose: 'login', otpId: 'otp-1' })
        .setProtectedHeader({ alg: 'RS256', kid: TEST_KID })
        .setSubject('user-1')
        .setAudience(TEST_OTP_AUD)
        .setIssuedAt(now - 600)
        .setExpirationTime(now - 300)
        .sign(pair.privateKey)

      await expect(service.verifyOtpVerificationToken(otpToken)).rejects.toThrow(GoneError)
    })

    it('throws ValidationError on invalid OTP verification token', async () => {
      const service = createTokenService({ keyProvider, config })
      await expect(service.verifyOtpVerificationToken('bad.token')).rejects.toThrow(
        ValidationError,
      )
    })
  })
})
