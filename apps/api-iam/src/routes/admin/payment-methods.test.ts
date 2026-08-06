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

type Row = { method: string; enabled: boolean; displayName?: string; config?: Record<string, unknown> }
type UpdateData = { enabled: boolean; displayName?: string; config?: Record<string, unknown> }

function makePrisma(configs: Row[]) {
  const rows = new Map(configs.map((c) => [c.method, c]))
  return {
    paymentMethodConfig: {
      findMany: vi.fn().mockResolvedValue([...rows.values()]),
      findUnique: vi.fn().mockImplementation(({ where }: { where: { method: string } }) => rows.get(where.method) ?? null),
      count: vi.fn().mockImplementation(({ where }: { where: { enabled: boolean } }) =>
        [...rows.values()].filter((r) => r.enabled === where.enabled).length,
      ),
      update: vi.fn().mockImplementation(({ where, data }: { where: { method: string }; data: UpdateData }) => {
        const row = rows.get(where.method)!
        row.enabled = data.enabled
        if (data.displayName !== undefined) row.displayName = data.displayName
        if (data.config !== undefined) row.config = data.config
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
    expect(body['items']).toEqual([
      { method: 'bancard', enabled: true, accounts: [] },
      { method: 'bank_transfer', enabled: false, accounts: [] },
    ])
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
    expect(body).toEqual({ method: 'bank_transfer', enabled: false, accounts: [] })
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

  const account = { bankName: 'Banco Itaú', accountType: 'checking', accountNumber: '123', accountHolder: 'Acme S.A.' }

  it('persists displayName and accounts', async () => {
    const app = buildApp(makePrisma([{ method: 'bank_transfer', enabled: true }]))

    const response = await app.request('/admin/payment-methods/bank_transfer', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, displayName: 'Transferencia bancaria', accounts: [account] }),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as JsonBody
    expect(body).toEqual({ method: 'bank_transfer', enabled: true, displayName: 'Transferencia bancaria', accounts: [account] })
  })

  it('leaves existing accounts untouched when accounts is omitted', async () => {
    const app = buildApp(
      makePrisma([{ method: 'bank_transfer', enabled: true, config: { accounts: [account] } }]),
    )

    const response = await app.request('/admin/payment-methods/bank_transfer', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true }),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as JsonBody
    expect(body['accounts']).toEqual([account])
  })

  it('clears accounts when sent an explicit empty array', async () => {
    const app = buildApp(
      makePrisma([{ method: 'bank_transfer', enabled: false, config: { accounts: [account] } }]),
    )

    const response = await app.request('/admin/payment-methods/bank_transfer', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: false, accounts: [] }),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as JsonBody
    expect(body['accounts']).toEqual([])
  })

  it('rejects an account missing required fields', async () => {
    const app = buildApp(makePrisma([{ method: 'bank_transfer', enabled: false }]))

    const response = await app.request('/admin/payment-methods/bank_transfer', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false, accounts: [{ bankName: 'Banco Itaú' }] }),
    })

    expect(response.status).toBe(422)
    const body = (await response.json()) as JsonBody
    expect(body['code']).toBe('payment_method.invalid_accounts')
  })

  it('rejects an invalid accountType', async () => {
    const app = buildApp(makePrisma([{ method: 'bank_transfer', enabled: false }]))

    const response = await app.request('/admin/payment-methods/bank_transfer', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false, accounts: [{ ...account, accountType: 'crypto' }] }),
    })

    expect(response.status).toBe(422)
  })

  it('refuses enabling bank_transfer with no accounts configured', async () => {
    const app = buildApp(makePrisma([{ method: 'bank_transfer', enabled: false }]))

    const response = await app.request('/admin/payment-methods/bank_transfer', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true }),
    })

    expect(response.status).toBe(409)
    const body = (await response.json()) as JsonBody
    expect(body['code']).toBe('payment_method.no_accounts_configured')
  })
})
