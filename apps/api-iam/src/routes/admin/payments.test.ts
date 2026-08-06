import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import { createAdminPaymentsRouter } from './payments.js'
import { requestId } from '../../middleware/request-id.js'
import { createErrorHandler } from '../../middleware/error-handler.js'
import { silentLogger } from '../../test-helpers/logger.js'
import { NotFoundError, ValidationError } from '../../errors.js'
import type { SettlementService } from '../../services/index.js'

type JsonBody = Record<string, unknown>

const fakeAuthGuard: MiddlewareHandler = async (c, next) => {
  c.set('user', { sub: 'admin-1', tenantId: 't', tenantUuid: 't', role: 'SuperAdmin', status: 'active', jti: 'j', kid: 'k' })
  await next()
}
const noopIdempotency: MiddlewareHandler = async (_c, next) => next()

function makeSettlementService(overrides: Partial<SettlementService> = {}): SettlementService {
  return {
    settlePayment: vi.fn().mockResolvedValue({
      payment: {
        id: 'payment-1', draftId: 'draft-1', tenantId: 'tenant-1', externalRef: 'CH-7K2M4Q', method: 'bank_transfer',
        amount: 75000, currency: 'PYG', status: 'approved', reason: undefined, settlementKind: 'agent_review',
        settledBy: 'admin-1', settledAt: new Date(), note: 'confirmed', initiatedAt: new Date(), confirmedAt: new Date(),
        createdAt: new Date(), updatedAt: new Date(),
      },
      alreadySettled: false,
    }),
    ...overrides,
  } as unknown as SettlementService
}

function makePrisma() {
  return {
    payment: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    tenant: { findUnique: vi.fn() },
  }
}

function buildApp(settlementService: SettlementService, prisma: ReturnType<typeof makePrisma> = makePrisma()) {
  const app = new Hono()
  app.use('*', requestId)
  app.route('/', createAdminPaymentsRouter(settlementService, prisma as never, fakeAuthGuard, noopIdempotency))
  app.onError(createErrorHandler(silentLogger))
  return app
}

describe('POST /admin/payments/:id/confirm', () => {
  it('settles via settlePayment with settlementKind agent_review and returns the payment', async () => {
    const settlementService = makeSettlementService()
    const app = buildApp(settlementService)

    const response = await app.request('/admin/payments/payment-1/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'confirmed via bank statement' }),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as JsonBody
    expect(body['status']).toBe('approved')
    expect(settlementService.settlePayment).toHaveBeenCalledWith({
      paymentId: 'payment-1', decision: 'approved', settlementKind: 'agent_review', settledBy: 'admin-1', note: 'confirmed via bank statement',
    })
  })

  // The mandatory note is a domain rule owned by settlement.service.ts, not a
  // structural one: the request schema stays permissive so the rule surfaces as
  // a typed 422 through errorHandler, like every other error here. Tightening
  // the schema instead would make zod-openapi reject it as a bare 400 that
  // never reaches errorHandler, since this service configures no defaultHook.
  it('surfaces an empty note as a typed 422 from the settlement service', async () => {
    const settlePayment = vi.fn().mockRejectedValue(new ValidationError('payment.note_required'))
    const settlementService = makeSettlementService({ settlePayment })
    const app = buildApp(settlementService)

    const response = await app.request('/admin/payments/payment-1/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: '' }),
    })

    expect(response.status).toBe(422)
    const body = (await response.json()) as JsonBody
    expect(body['code']).toBe('payment.note_required')
  })

  it('returns 404 for an unmatched payment id', async () => {
    const settlementService = makeSettlementService({
      settlePayment: vi.fn().mockRejectedValue(new NotFoundError('payment.not_found')),
    })
    const app = buildApp(settlementService)

    const response = await app.request('/admin/payments/unknown/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'confirmed' }),
    })

    expect(response.status).toBe(404)
  })
})

describe('POST /admin/payments/:id/reject', () => {
  it('settles via settlePayment with decision declined', async () => {
    const settlementService = makeSettlementService({
      settlePayment: vi.fn().mockResolvedValue({
        payment: { id: 'payment-1', tenantId: 'tenant-1', status: 'declined', method: 'bank_transfer', externalRef: 'CH-7K2M4Q', amount: 75000, currency: 'PYG', settlementKind: 'agent_review', settledBy: 'admin-1', settledAt: new Date(), note: 'amount mismatch', createdAt: new Date() },
        alreadySettled: false,
      }),
    })
    const app = buildApp(settlementService)

    const response = await app.request('/admin/payments/payment-1/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'amount mismatch' }),
    })

    expect(response.status).toBe(200)
    expect(settlementService.settlePayment).toHaveBeenCalledWith({
      paymentId: 'payment-1', decision: 'declined', settlementKind: 'agent_review', settledBy: 'admin-1', note: 'amount mismatch',
    })
  })

  // Task 3.2: reject → same-reference retry → confirm. The route places no
  // extra guard beyond forwarding to settlePayment — reopening a declined
  // payment for a later confirm is settlement.service's job (see
  // settlement.service.test.ts "reopens a declined payment for a later confirm").
  it('allows a later confirm on the same payment after a reject', async () => {
    const basePayment = {
      id: 'payment-1', draftId: 'draft-1', tenantId: 'tenant-1', externalRef: 'CH-7K2M4Q', method: 'bank_transfer',
      amount: 75000, currency: 'PYG', reason: undefined, settlementKind: 'agent_review', settledBy: 'admin-1',
      settledAt: new Date(), note: 'x', initiatedAt: new Date(), confirmedAt: undefined, createdAt: new Date(), updatedAt: new Date(),
    }
    const settlePayment = vi
      .fn()
      .mockResolvedValueOnce({ payment: { ...basePayment, status: 'declined' }, alreadySettled: false })
      .mockResolvedValueOnce({ payment: { ...basePayment, status: 'approved' }, alreadySettled: false })
    const settlementService = makeSettlementService({ settlePayment })
    const app = buildApp(settlementService)

    const rejectResponse = await app.request('/admin/payments/payment-1/reject', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: 'amount mismatch' }),
    })
    const confirmResponse = await app.request('/admin/payments/payment-1/confirm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: 're-transferred with correct amount' }),
    })

    expect(rejectResponse.status).toBe(200)
    expect(confirmResponse.status).toBe(200)
    expect(settlePayment).toHaveBeenCalledTimes(2)
    expect(settlePayment).toHaveBeenNthCalledWith(1, expect.objectContaining({ decision: 'declined' }))
    expect(settlePayment).toHaveBeenNthCalledWith(2, expect.objectContaining({ decision: 'approved' }))
  })
})

describe('GET /admin/payments', () => {
  it('accepts status=in_review and filters by it (the backoffice "Awaiting review" filter)', async () => {
    const prisma = makePrisma()
    const app = buildApp(makeSettlementService(), prisma)

    const response = await app.request('/admin/payments?status=in_review')

    expect(response.status).toBe(200)
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'in_review' }) }),
    )
  })
})

describe('GET /admin/tenants/:tenantId/payments', () => {
  it('returns 404 when the tenant does not exist', async () => {
    const app = buildApp(makeSettlementService(), makePrisma())

    const response = await app.request('/admin/tenants/unknown/payments')

    expect(response.status).toBe(404)
  })
})
