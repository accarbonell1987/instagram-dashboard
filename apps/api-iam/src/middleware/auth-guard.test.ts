import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import { UnauthorizedError } from '../errors.js'
import { requestId } from './request-id.js'
import { createAuthGuard } from './auth-guard.js'
import { createErrorHandler } from './error-handler.js'
import { silentLogger } from '../test-helpers/logger.js'
import type { TokenService } from '../services/token.service.js'
import type { AccessTokenClaims } from '../services/token.service.js'

type JsonBody = Record<string, unknown>

function makeTokenService(overrides?: Partial<TokenService>): TokenService {
  return {
    signAccessToken: vi.fn(),
    verifyAccessToken: vi.fn(),
    signRefreshTokenRaw: vi.fn(),
    verifyOtpVerificationToken: vi.fn(),
    getJwks: vi.fn(),
    ...overrides,
  } as unknown as TokenService
}

const validClaims: AccessTokenClaims = {
  sub: 'user-1',
  tenant_id: 'acme',
  tenant_uuid: 'tenant-uuid-1',
  tenant_slug: 'acme',
  role: 'User',
  jti: 'jti-1',
  kid: 'kid-1',
  user_status: 'active',
}

function buildApp(tokenService: TokenService) {
  const app = new Hono()
  app.use('*', requestId)
  app.use('/protected', createAuthGuard(tokenService))
  app.get('/protected', (c) => c.json({ user: c.var.user }))
  app.onError(createErrorHandler(silentLogger))
  return app
}

describe('createAuthGuard', () => {
  it('sets c.var.user from a valid Bearer token', async () => {
    const tokenService = makeTokenService({
      verifyAccessToken: vi.fn().mockResolvedValue(validClaims),
    })
    const app = buildApp(tokenService)

    const response = await app.request('/protected', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as JsonBody
    const user = body['user'] as JsonBody
    expect(user['sub']).toBe('user-1')
    expect(user['tenantId']).toBe('acme')
    expect(user['tenantUuid']).toBe('tenant-uuid-1')
    expect(user['status']).toBe('active')
  })

  it('throws UnauthorizedError when Authorization header is missing', async () => {
    const tokenService = makeTokenService()
    const app = buildApp(tokenService)

    const response = await app.request('/protected')
    expect(response.status).toBe(401)
    const body = (await response.json()) as JsonBody
    expect(body['code']).toBe('auth.unauthorized')
  })

  it('throws UnauthorizedError when header does not start with "Bearer "', async () => {
    const tokenService = makeTokenService()
    const app = buildApp(tokenService)

    const response = await app.request('/protected', {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    })
    expect(response.status).toBe(401)
  })

  it('propagates UnauthorizedError from tokenService (expired token)', async () => {
    const tokenService = makeTokenService({
      verifyAccessToken: vi.fn().mockRejectedValue(new UnauthorizedError('auth.token_expired')),
    })
    const app = buildApp(tokenService)

    const response = await app.request('/protected', {
      headers: { Authorization: 'Bearer expired-token' },
    })
    expect(response.status).toBe(401)
    const body = (await response.json()) as JsonBody
    expect(body['code']).toBe('auth.token_expired')
  })

  it('propagates UnauthorizedError from tokenService (invalid signature)', async () => {
    const tokenService = makeTokenService({
      verifyAccessToken: vi.fn().mockRejectedValue(new UnauthorizedError('auth.token_invalid')),
    })
    const app = buildApp(tokenService)

    const response = await app.request('/protected', {
      headers: { Authorization: 'Bearer bad-signature-token' },
    })
    expect(response.status).toBe(401)
    const body = (await response.json()) as JsonBody
    expect(body['code']).toBe('auth.token_invalid')
  })

  // ── T-006 Task 6.5: stale token without user_status → 'active' ──
  it('treats missing user_status claim as active (backward compat)', async () => {
    const staleClaims: AccessTokenClaims = {
      sub: 'user-1',
      tenant_id: 'acme',
      tenant_uuid: 'tenant-uuid-1',
      tenant_slug: 'acme',
      role: 'User',
      jti: 'jti-1',
      kid: 'kid-1',
      // user_status is absent — simulating pre-change token
    }
    const tokenService = makeTokenService({
      verifyAccessToken: vi.fn().mockResolvedValue(staleClaims),
    })
    const app = buildApp(tokenService)

    const response = await app.request('/protected', {
      headers: { Authorization: 'Bearer stale-token' },
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as JsonBody
    const user = body['user'] as JsonBody
    expect(user['status']).toBe('active')
  })
})
