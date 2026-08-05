import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import { createAdminPaymentMethodsRouter } from './payment-methods.js'
import { requestId } from '../../middleware/request-id.js'
import { createErrorHandler } from '../../middleware/error-handler.js'
import { silentLogger } from '../../test-helpers/logger.js'

type JsonBody = Record<string, unknown>

const fakeAuthGuard: MiddlewareHandler = async (c, next) => {
  c.set('user', { sub: 'admin-1', tenantId: 't', tenantUuid: 't', role: 'SuperAdmin', status: 'active', jti: 'j', kid: 'k' })
  await next()
}
const noopIdempotency: MiddlewareHandler = async (_c, next) => next()

function makePrisma(configs: { method: string; enabled: boolean }[]) {
  const rows = new Map(configs.map((c) => [c.method, c]))
  return {
    paymentMethodConfig: {
      findMany: vi.fn().mockResolvedValue([...rows.values()]),
      findUnique: vi.fn().mockImplementation(({ where }: { where: { method: string } }) => rows.get(where.method) ?? null),
      count: vi.fn().mockImplementation(({ where }: { where: { enabled: boolean } }) =>
        [...rows.values()].filter((r) => r.enabled === where.enabled).length,
      ),
      update: vi.fn().mockImplementation(({ where, data }: { where: { method: string }; data: { enabled: boolean } }) => {
        const row = rows.get(where.method)!
        row.enabled = data.enabled
        return row
      }),
    },
  }
}

function buildApp(prisma: ReturnType<typeof makePrisma>) {
  const app = new Hono()
  app.use('*', requestId)
  app.route('/', createAdminPaymentMethodsRouter(prisma as never, fakeAuthGuard, noopIdempotency))
  app.onError(createErrorHandler(silentLogger))
  return app
}

describe('GET /admin/payment-methods', () => {
  it('lists all configured methods', async () => {
    const app = buildApp(makePrisma([{ method: 'bancard', enabled: true }, { method: 'bank_transfer', enabled: false }]))

    const response = await app.request('/admin/payment-methods')

    expect(response.status).toBe(200)
    const body = (await response.json()) as JsonBody
    expect(body['items']).toEqual([{ method: 'bancard', enabled: true }, { method: 'bank_transfer', enabled: false }])
  })
})

describe('PATCH /admin/payment-methods/:method', () => {
  it('toggles enabled when another method stays enabled', async () => {
    const app = buildApp(makePrisma([{ method: 'bancard', enabled: true }, { method: 'bank_transfer', enabled: true }]))

    const response = await app.request('/admin/payment-methods/bank_transfer', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: false }),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as JsonBody
    expect(body).toEqual({ method: 'bank_transfer', enabled: false })
  })

  it('returns 409 when disabling the last enabled method', async () => {
    const app = buildApp(makePrisma([{ method: 'bancard', enabled: true }, { method: 'bank_transfer', enabled: false }]))

    const response = await app.request('/admin/payment-methods/bancard', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: false }),
    })

    expect(response.status).toBe(409)
  })

  it('returns 404 for an unknown method row', async () => {
    const app = buildApp(makePrisma([]))

    // 'bancard' passes the path enum but has no seeded row in this test's fake DB
    const response = await app.request('/admin/payment-methods/bancard', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true }),
    })

    expect(response.status).toBe(404)
  })
})
