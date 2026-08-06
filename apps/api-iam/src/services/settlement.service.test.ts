import { describe, it, expect, vi } from 'vitest'
import { ValidationError } from '../errors.js'
import { createSettlementService } from './settlement.service.js'
import { silentLogger } from '../test-helpers/logger.js'

function makeRawPayment(overrides: Partial<{ tenantId: string | null; status: string }> = {}) {
  return {
    id: 'payment-1',
    draftId: 'draft-1',
    tenantId: null,
    externalRef: 'CH-2K4M9Q',
    method: 'bank_transfer',
    amount: { toNumber: () => 75000 },
    currency: 'PYG',
    reason: null,
    settlementKind: null,
    settledBy: null,
    settledAt: null,
    note: null,
    initiatedAt: new Date(),
    confirmedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'pending',
    ...overrides,
  }
}

function makeTx(opts: {
  updateManyCount?: number
  raw?: ReturnType<typeof makeRawPayment>
  tenant?: { id: string; status: string; name?: string; planId?: string } | null
  user?: { id: string; email: string; fullName: string | null } | null
} = {}) {
  return {
    payment: {
      updateMany: vi.fn().mockResolvedValue({ count: opts.updateManyCount ?? 1 }),
      findUnique: vi.fn().mockResolvedValue(opts.raw ?? makeRawPayment()),
    },
    tenant: {
      findUnique: vi.fn().mockResolvedValue(opts.tenant ?? null),
      update: vi.fn().mockResolvedValue({}),
    },
    user: {
      findFirst: vi.fn().mockResolvedValue(opts.user === undefined ? null : opts.user),
      update: vi.fn().mockResolvedValue({}),
    },
    document: {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
    },
  }
}

function makeDeps(tx: ReturnType<typeof makeTx>) {
  const prisma = { $transaction: vi.fn().mockImplementation((fn: (t: unknown) => Promise<unknown>) => fn(tx)) }
  const pdfAdapter = { generate: vi.fn().mockResolvedValue(Buffer.from('fake-pdf')) }
  const storageAdapter = { upload: vi.fn().mockResolvedValue(undefined), signedUrl: vi.fn() }
  const emailAdapter = { send: vi.fn().mockResolvedValue(undefined), sendPlanChangeNotification: vi.fn() }
  const config = { HUB_BASE_URL: 'http://localhost:3001' }
  return { prisma, pdfAdapter, storageAdapter, emailAdapter, config, logger: silentLogger }
}

describe('SettlementService.settlePayment', () => {
  it.each(['agent_review', 'manual_admin'] as const)(
    'rejects %s with an empty/missing note, without opening a transaction',
    async (settlementKind) => {
      const deps = makeDeps(makeTx())
      const service = createSettlementService(deps as never)

      await expect(
        service.settlePayment({ paymentId: 'payment-1', decision: 'approved', settlementKind, settledBy: 'admin-1', note: '  ' }),
      ).rejects.toThrow(ValidationError)
      expect(deps.prisma.$transaction).not.toHaveBeenCalled()
    },
  )

  it('does not require a note for gateway_webhook', async () => {
    const tx = makeTx()
    const deps = makeDeps(tx)
    const service = createSettlementService(deps as never)

    const result = await service.settlePayment({
      paymentId: 'payment-1', decision: 'approved', settlementKind: 'gateway_webhook', settledBy: undefined, note: undefined,
    })

    expect(result.alreadySettled).toBe(false)
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'payment-1', status: { in: ['pending', 'in_review', 'declined'] } },
        data: expect.objectContaining({ status: 'approved', settlementKind: 'gateway_webhook' }),
      }),
    )
  })

  it('is idempotent: a second settlement of an already-settled payment is a no-op', async () => {
    const tx = makeTx({ updateManyCount: 0, raw: makeRawPayment({ status: 'approved', tenantId: 'tenant-1' }) })
    const service = createSettlementService(makeDeps(tx) as never)

    const result = await service.settlePayment({
      paymentId: 'payment-1', decision: 'approved', settlementKind: 'agent_review', settledBy: 'admin-1', note: 'confirmed via bank statement',
    })

    expect(result.alreadySettled).toBe(true)
    expect(result.payment.status).toBe('approved')
    expect(tx.tenant.update).not.toHaveBeenCalled()
  })

  it.each(['pending', 'suspended'] as const)(
    'activates a %s tenant on approval when a tenant is attached (reactivation on late confirmation)',
    async (tenantStatus) => {
      const tx = makeTx({ raw: makeRawPayment({ tenantId: 'tenant-1' }), tenant: { id: 'tenant-1', status: tenantStatus } })
      const service = createSettlementService(makeDeps(tx) as never)

      await service.settlePayment({
        paymentId: 'payment-1', decision: 'approved', settlementKind: 'manual_admin', settledBy: 'admin-1', note: 'confirmed',
      })

      expect(tx.tenant.update).toHaveBeenCalledWith({ where: { id: 'tenant-1' }, data: { status: 'active' } })
    },
  )

  it('generates invoice+receipt PDFs, fills the invoice placeholder, and emails invoice+receipt attachments on activation', async () => {
    const tx = makeTx({
      raw: makeRawPayment({ tenantId: 'tenant-1' }),
      tenant: { id: 'tenant-1', status: 'pending', name: 'ACME Corp', planId: 'professional' },
      user: { id: 'user-1', email: 'ana@acme.com', fullName: 'Ana Pérez' },
    })
    tx.document.findFirst.mockResolvedValue({ id: 'doc-invoice-1' })
    const deps = makeDeps(tx)
    const service = createSettlementService(deps as never)

    await service.settlePayment({
      paymentId: 'payment-1', decision: 'approved', settlementKind: 'manual_admin', settledBy: 'admin-1', note: 'confirmed',
    })

    expect(deps.pdfAdapter.generate).toHaveBeenCalledWith(expect.objectContaining({ type: 'invoice' }))
    expect(deps.pdfAdapter.generate).toHaveBeenCalledWith(expect.objectContaining({ type: 'receipt' }))
    expect(tx.document.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'doc-invoice-1' }, data: expect.objectContaining({ status: 'ready' }) }),
    )
    expect(tx.document.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'receipt', status: 'ready' }) }),
    )
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' }, data: expect.objectContaining({ activationTokenUsed: false }) }),
    )
    expect(deps.emailAdapter.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ana@acme.com',
        attachments: [
          expect.objectContaining({ filename: 'factura.pdf' }),
          expect.objectContaining({ filename: 'recibo.pdf' }),
        ],
      }),
    )
  })

  it('does not re-send the confirmation email on a repeat settle of an already-active tenant', async () => {
    const tx = makeTx({
      updateManyCount: 0,
      raw: makeRawPayment({ status: 'approved', tenantId: 'tenant-1' }),
      tenant: { id: 'tenant-1', status: 'active' },
    })
    const deps = makeDeps(tx)
    const service = createSettlementService(deps as never)

    await service.settlePayment({
      paymentId: 'payment-1', decision: 'approved', settlementKind: 'agent_review', settledBy: 'admin-1', note: 'duplicate confirm',
    })

    expect(tx.tenant.update).not.toHaveBeenCalled()
    expect(deps.emailAdapter.send).not.toHaveBeenCalled()
  })

  it('does not activate a tenant on decline', async () => {
    const tx = makeTx({ raw: makeRawPayment({ tenantId: 'tenant-1', status: 'declined' }), tenant: { id: 'tenant-1', status: 'pending' } })
    const service = createSettlementService(makeDeps(tx) as never)

    await service.settlePayment({
      paymentId: 'payment-1', decision: 'declined', settlementKind: 'agent_review', settledBy: 'admin-1', note: 'amount mismatch, rejected',
    })

    expect(tx.tenant.update).not.toHaveBeenCalled()
  })

  it('reopens a declined payment for a later confirm (reject → same-reference retry → confirm)', async () => {
    const tx = makeTx({ raw: makeRawPayment({ status: 'declined', tenantId: 'tenant-1' }), tenant: { id: 'tenant-1', status: 'pending' } })
    const service = createSettlementService(makeDeps(tx) as never)

    const result = await service.settlePayment({
      paymentId: 'payment-1', decision: 'approved', settlementKind: 'agent_review', settledBy: 'admin-1', note: 're-transferred with correct amount',
    })

    expect(result.alreadySettled).toBe(false)
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'payment-1', status: { in: ['pending', 'in_review', 'declined'] } } }),
    )
    expect(tx.tenant.update).toHaveBeenCalledWith({ where: { id: 'tenant-1' }, data: { status: 'active' } })
  })

  it('defers the confirmation email until the caller invokes finalize (caller-owned tx)', async () => {
    const tx = makeTx({
      raw: makeRawPayment({ tenantId: 'tenant-1' }),
      tenant: { id: 'tenant-1', status: 'pending', name: 'ACME Corp', planId: 'professional' },
      user: { id: 'user-1', email: 'ana@acme.com', fullName: 'Ana Pérez' },
    })
    tx.document.findFirst.mockResolvedValue({ id: 'doc-invoice-1' })
    const deps = makeDeps(tx)
    const service = createSettlementService(deps as never)

    const result = await service.settlePayment(
      { paymentId: 'payment-1', decision: 'approved', settlementKind: 'manual_admin', settledBy: 'admin-1', note: 'confirmed' },
      tx as never,
    )

    // Not sent while the caller's transaction is still "open" (this call
    // already returned, but with a real tx it would still be uncommitted).
    expect(deps.emailAdapter.send).not.toHaveBeenCalled()
    expect(typeof result.finalize).toBe('function')

    await result.finalize?.()
    expect(deps.emailAdapter.send).toHaveBeenCalled()
  })

  it('sends the confirmation email itself when it owns the transaction (no caller tx)', async () => {
    const tx = makeTx({
      raw: makeRawPayment({ tenantId: 'tenant-1' }),
      tenant: { id: 'tenant-1', status: 'pending', name: 'ACME Corp', planId: 'professional' },
      user: { id: 'user-1', email: 'ana@acme.com', fullName: 'Ana Pérez' },
    })
    tx.document.findFirst.mockResolvedValue({ id: 'doc-invoice-1' })
    const deps = makeDeps(tx)
    const service = createSettlementService(deps as never)

    const result = await service.settlePayment({
      paymentId: 'payment-1', decision: 'approved', settlementKind: 'manual_admin', settledBy: 'admin-1', note: 'confirmed',
    })

    expect(deps.emailAdapter.send).toHaveBeenCalled()
    expect(result.finalize).toBeUndefined()
  })

  it('uses a caller-provided tx instead of opening its own transaction', async () => {
    const tx = makeTx()
    const deps = makeDeps(tx)
    const service = createSettlementService(deps as never)

    await service.settlePayment(
      { paymentId: 'payment-1', decision: 'approved', settlementKind: 'gateway_webhook', settledBy: undefined, note: undefined },
      tx as never,
    )

    expect(deps.prisma.$transaction).not.toHaveBeenCalled()
    expect(tx.payment.updateMany).toHaveBeenCalledTimes(1)
  })
})
