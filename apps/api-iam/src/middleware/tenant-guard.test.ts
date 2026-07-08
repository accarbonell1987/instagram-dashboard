import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { requestId } from './request-id.js'
import { createTenantGuard } from './tenant-guard.js'
import { createErrorHandler } from './error-handler.js'
import { silentLogger } from '../test-helpers/logger.js'
import type { UserRole } from '../domain/index.js'

type JsonBody = Record<string, unknown>

interface AuthUserStub {
  sub: string
  tenantId: string
  tenantUuid: string
  role: UserRole
  status: string
  jti: string
  kid: string
}

const acmeUser: AuthUserStub = {
  sub: 'user-1',
  tenantId: 'acme',
  tenantUuid: 'tenant-uuid-1',
  role: 'User',
  status: 'active',
  jti: 'jti-1',
  kid: 'kid-1',
}

function buildApp(user?: AuthUserStub) {
  const app = new Hono()
  app.use('*', requestId)
  // Inject user into context to simulate auth-guard having run
  app.use('*', async (c, next) => {
    if (user !== undefined) {
      c.set('user', user)
    }
    await next()
  })
  app.use('/guarded', createTenantGuard())
  app.get('/guarded', (c) => c.json({ ok: true }))
  app.onError(createErrorHandler(silentLogger))
  return app
}

describe('createTenantGuard', () => {
  it('passes through when X-Tenant-Slug matches JWT tenantId', async () => {
    const app = buildApp(acmeUser)
    const response = await app.request('/guarded', {
      headers: { 'X-Tenant-Slug': 'acme' },
    })
    expect(response.status).toBe(200)
  })

  it('passes through when X-Tenant-Slug header is absent', async () => {
    const app = buildApp(acmeUser)
    const response = await app.request('/guarded')
    expect(response.status).toBe(200)
  })

  it('throws ForbiddenError when X-Tenant-Slug does not match JWT tenantId', async () => {
    const app = buildApp(acmeUser)
    const response = await app.request('/guarded', {
      headers: { 'X-Tenant-Slug': 'globex' },
    })
    expect(response.status).toBe(403)
    const body = (await response.json()) as JsonBody
    expect(body['code']).toBe('auth.tenant_mismatch')
  })
})
