import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import { createPaymentMethodsRouter } from './index.js'
import { requestId } from '../../middleware/request-id.js'
import { createErrorHandler } from '../../middleware/error-handler.js'
import { silentLogger } from '../../test-helpers/logger.js'

function makePrisma(rows: { method: string; enabled: boolean; displayName: string }[]) {
  return {
    paymentMethodConfig: {
      findMany: vi.fn().mockImplementation(({ where }: { where: { enabled: boolean } }) =>
        rows.filter((r) => r.enabled === where.enabled).map((r) => ({ method: r.method, displayName: r.displayName })),
      ),
    },
  }
}

function buildApp(prisma: ReturnType<typeof makePrisma>) {
  const app = new Hono()
  app.use('*', requestId)
  app.route('/', createPaymentMethodsRouter(prisma as never))
  app.onError(createErrorHandler(silentLogger))
  return app
}

describe('GET /payment-methods (public)', () => {
  it('returns only enabled methods, no bank-account details', async () => {
    const app = buildApp(
      makePrisma([
        { method: 'bancard', enabled: true, displayName: 'Tarjeta (Bancard)' },
        { method: 'bank_transfer', enabled: false, displayName: 'Transferencia bancaria' },
      ]),
    )

    const response = await app.request('/payment-methods')

    expect(response.status).toBe(200)
    const body = (await response.json()) as { items: { method: string; displayName: string }[] }
    expect(body.items).toEqual([{ method: 'bancard', displayName: 'Tarjeta (Bancard)' }])
  })

  it('returns an empty list when nothing is enabled', async () => {
    const app = buildApp(makePrisma([{ method: 'bancard', enabled: false, displayName: 'Tarjeta (Bancard)' }]))

    const response = await app.request('/payment-methods')

    const body = (await response.json()) as { items: unknown[] }
    expect(body.items).toEqual([])
  })
})
