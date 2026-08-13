import { describe, it, expect, vi } from 'vitest'
import { createBillingService } from './billing.service.js'
import { ConflictError, ForbiddenError, NotFoundError } from '../errors.js'
import type { BillingServiceDeps } from './billing.service.js'

function makeDocument(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'doc-1',
    tenantId: 'tenant-uuid-1',
    type: 'invoice' as const,
    storageKey: 'tenants/tenant-uuid-1/documents/doc-1.pdf',
    status: 'ready' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeDeps(overrides: Partial<BillingServiceDeps> = {}): BillingServiceDeps {
  return {
    documentRepo: {
      create: vi.fn(),
      findById: vi.fn().mockResolvedValue(makeDocument()),
      findByTenantId: vi.fn(),
      updateStatus: vi.fn(),
    },
    storageAdapter: {
      upload: vi.fn(),
      signedUrl: vi.fn().mockResolvedValue('https://storage.example.com/signed-url'),
    },
    paymentRepo: {
      create: vi.fn(),
      findByDraftId: vi.fn(),
      findByExternalRef: vi.fn(),
      listByTenant: vi.fn().mockResolvedValue([]),
      updateStatus: vi.fn(),
      cancelPendingByDraftId: vi.fn(),
    },
    ...overrides,
  }
}

function makePayment(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'pay-1',
    draftId: 'draft-1',
    tenantId: 'tenant-uuid-1',
    externalRef: 'CH-2K4M9Q',
    method: 'bank_transfer' as const,
    amount: 75000,
    currency: 'PYG',
    status: 'pending' as const,
    reason: undefined,
    settlementKind: undefined,
    settledBy: undefined,
    settledAt: undefined,
    note: undefined,
    initiatedAt: new Date('2026-01-01'),
    confirmedAt: undefined,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

describe('BillingService', () => {
  describe('getSignedDocumentUrl', () => {
    it('returns url and expiresAt for valid document with matching tenant', async () => {
      const deps = makeDeps()
      const service = createBillingService(deps)

      const result = await service.getSignedDocumentUrl({
        documentId: 'doc-1',
        tenantUuid: 'tenant-uuid-1',
      })

      expect(result.url).toBe('https://storage.example.com/signed-url')
      expect(result.expiresAt).toBeInstanceOf(Date)
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now())
      expect(deps.storageAdapter.signedUrl).toHaveBeenCalledWith({
        key: 'tenants/tenant-uuid-1/documents/doc-1.pdf',
        ttlSeconds: 300,
      })
    })

    it('throws NotFoundError when document does not exist', async () => {
      const deps = makeDeps({
        documentRepo: {
          create: vi.fn(),
          findById: vi.fn().mockResolvedValue(null),
          findByTenantId: vi.fn(),
          updateStatus: vi.fn(),
        },
      })
      const service = createBillingService(deps)

      await expect(
        service.getSignedDocumentUrl({ documentId: 'unknown-doc', tenantUuid: 'tenant-uuid-1' }),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('throws ForbiddenError when document belongs to different tenant', async () => {
      const deps = makeDeps({
        documentRepo: {
          create: vi.fn(),
          findById: vi.fn().mockResolvedValue(makeDocument({ tenantId: 'tenant-uuid-2' })),
          findByTenantId: vi.fn(),
          updateStatus: vi.fn(),
        },
      })
      const service = createBillingService(deps)

      await expect(
        service.getSignedDocumentUrl({ documentId: 'doc-1', tenantUuid: 'tenant-uuid-1' }),
      ).rejects.toBeInstanceOf(ForbiddenError)
    })

    it('throws ConflictError when the document is a placeholder (status: pending)', async () => {
      const deps = makeDeps({
        documentRepo: {
          create: vi.fn(),
          findById: vi.fn().mockResolvedValue(makeDocument({ status: 'pending', storageKey: 'pending' })),
          findByTenantId: vi.fn(),
          updateStatus: vi.fn(),
        },
      })
      const service = createBillingService(deps)

      await expect(
        service.getSignedDocumentUrl({ documentId: 'doc-1', tenantUuid: 'tenant-uuid-1' }),
      ).rejects.toBeInstanceOf(ConflictError)
      expect(deps.storageAdapter.signedUrl).not.toHaveBeenCalled()
    })

    it('expiresAt is approximately 5 minutes in the future', async () => {
      const deps = makeDeps()
      const service = createBillingService(deps)
      const before = Date.now()

      const result = await service.getSignedDocumentUrl({
        documentId: 'doc-1',
        tenantUuid: 'tenant-uuid-1',
      })

      const after = Date.now()
      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 300_000 - 10)
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(after + 300_000 + 10)
    })
  })

  // ── listPayments (payment-visibility spec) ──────────────────────────────────

  describe('listPayments', () => {
    it('scopes to the caller tenant and maps method/status/settlementKind/reference', async () => {
      const deps = makeDeps({ paymentRepo: { ...makeDeps().paymentRepo, listByTenant: vi.fn().mockResolvedValue([makePayment()]) } })
      const service = createBillingService(deps)

      const result = await service.listPayments({ tenantUuid: 'tenant-uuid-1', page: 1, pageSize: 10 })

      expect(deps.paymentRepo.listByTenant).toHaveBeenCalledWith('tenant-uuid-1')
      expect(result.items).toEqual([
        expect.objectContaining({ method: 'bank_transfer', status: 'pending', reference: 'CH-2K4M9Q' }),
      ])
      expect(result.total).toBe(1)
    })

    it('paginates in-memory', async () => {
      const payments = [makePayment({ id: 'pay-1' }), makePayment({ id: 'pay-2' }), makePayment({ id: 'pay-3' })]
      const deps = makeDeps({ paymentRepo: { ...makeDeps().paymentRepo, listByTenant: vi.fn().mockResolvedValue(payments) } })
      const service = createBillingService(deps)

      const result = await service.listPayments({ tenantUuid: 'tenant-uuid-1', page: 2, pageSize: 2 })

      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(3)
    })
  })

  describe('listInvoices', () => {
    /**
     * There is no invoicing subsystem — nothing issues a document on a cycle and
     * no row carries an invoice number or a due date. An invoice is the charge
     * seen fiscally, so the list is built from the tenant's payments.
     */
    it('projects the tenant payments into invoices', async () => {
      const deps = makeDeps()
      deps.paymentRepo.listByTenant = vi.fn().mockResolvedValue([
        makePayment({
          id: 'pay-1',
          status: 'approved',
          amount: 75000,
          confirmedAt: new Date('2026-02-03T10:00:00.000Z'),
        }),
      ])
      deps.documentRepo.findByTenantId = vi.fn().mockResolvedValue([makeDocument()])
      const service = createBillingService(deps)

      const result = await service.listInvoices({
        tenantUuid: 'tenant-uuid-1',
        page: 1,
        pageSize: 10,
      })

      expect(result.total).toBe(1)
      expect(result.items[0]).toEqual({
        id: 'pay-1',
        issuedAt: '2026-02-03T10:00:00.000Z',
        total: 75000,
        currency: 'PYG',
        status: 'paid',
        documentId: 'doc-1',
      })
    })

    // An open charge has no settlement date; the date it was raised is the only
    // honest answer.
    it('dates an unsettled invoice by when it was raised', async () => {
      const deps = makeDeps()
      deps.paymentRepo.listByTenant = vi
        .fn()
        .mockResolvedValue([makePayment({ status: 'pending', confirmedAt: undefined })])
      deps.documentRepo.findByTenantId = vi.fn().mockResolvedValue([])
      const service = createBillingService(deps)

      const result = await service.listInvoices({
        tenantUuid: 'tenant-uuid-1',
        page: 1,
        pageSize: 10,
      })

      expect(result.items[0]?.issuedAt).toBe(new Date('2026-01-01').toISOString())
      expect(result.items[0]?.status).toBe('pending')
    })

    it.each([
      ['approved', 'paid'],
      ['pending', 'pending'],
      ['in_review', 'pending'],
      ['declined', 'cancelled'],
      ['cancelled', 'cancelled'],
      ['reversed', 'cancelled'],
    ])('reads a %s payment as a %s invoice', async (paymentStatus, invoiceStatus) => {
      const deps = makeDeps()
      deps.paymentRepo.listByTenant = vi
        .fn()
        .mockResolvedValue([makePayment({ status: paymentStatus })])
      deps.documentRepo.findByTenantId = vi.fn().mockResolvedValue([makeDocument()])
      const service = createBillingService(deps)

      const result = await service.listInvoices({
        tenantUuid: 'tenant-uuid-1',
        page: 1,
        pageSize: 10,
      })

      expect(result.items[0]?.status).toBe(invoiceStatus)
    })

    /**
     * submit.service creates the invoice row as a `pending` placeholder with a
     * storageKey of 'pending'. Offering it would hand the customer a download
     * button that resolves to nothing.
     */
    it('offers no document while the invoice PDF is still a placeholder', async () => {
      const deps = makeDeps()
      deps.paymentRepo.listByTenant = vi
        .fn()
        .mockResolvedValue([makePayment({ status: 'approved' })])
      deps.documentRepo.findByTenantId = vi
        .fn()
        .mockResolvedValue([makeDocument({ status: 'pending', storageKey: 'pending' })])
      const service = createBillingService(deps)

      const result = await service.listInvoices({
        tenantUuid: 'tenant-uuid-1',
        page: 1,
        pageSize: 10,
      })

      expect(result.items[0]?.documentId).toBeNull()
    })

    // You do not get a fiscal document for a charge that never settled.
    it('offers no document for a payment that was never settled', async () => {
      const deps = makeDeps()
      deps.paymentRepo.listByTenant = vi
        .fn()
        .mockResolvedValue([makePayment({ status: 'declined' })])
      deps.documentRepo.findByTenantId = vi.fn().mockResolvedValue([makeDocument()])
      const service = createBillingService(deps)

      const result = await service.listInvoices({
        tenantUuid: 'tenant-uuid-1',
        page: 1,
        pageSize: 10,
      })

      expect(result.items[0]?.documentId).toBeNull()
    })

    // The contract's `contract` documents are not invoices.
    it('ignores documents of other types', async () => {
      const deps = makeDeps()
      deps.paymentRepo.listByTenant = vi
        .fn()
        .mockResolvedValue([makePayment({ status: 'approved' })])
      deps.documentRepo.findByTenantId = vi
        .fn()
        .mockResolvedValue([makeDocument({ id: 'doc-contract', type: 'contract' })])
      const service = createBillingService(deps)

      const result = await service.listInvoices({
        tenantUuid: 'tenant-uuid-1',
        page: 1,
        pageSize: 10,
      })

      expect(result.items[0]?.documentId).toBeNull()
    })

    it('paginates without losing the total', async () => {
      const deps = makeDeps()
      deps.paymentRepo.listByTenant = vi
        .fn()
        .mockResolvedValue([
          makePayment({ id: 'pay-1' }),
          makePayment({ id: 'pay-2' }),
          makePayment({ id: 'pay-3' }),
        ])
      deps.documentRepo.findByTenantId = vi.fn().mockResolvedValue([])
      const service = createBillingService(deps)

      const result = await service.listInvoices({
        tenantUuid: 'tenant-uuid-1',
        page: 2,
        pageSize: 2,
      })

      expect(result.items).toHaveLength(1)
      expect(result.items[0]?.id).toBe('pay-3')
      expect(result.total).toBe(3)
    })
  })

  describe('getInvoiceSignedUrl', () => {
    it('signs the tenant invoice document behind a settled charge', async () => {
      const deps = makeDeps()
      deps.paymentRepo.listByTenant = vi
        .fn()
        .mockResolvedValue([makePayment({ id: 'pay-1', status: 'approved' })])
      deps.documentRepo.findByTenantId = vi.fn().mockResolvedValue([makeDocument()])
      const service = createBillingService(deps)

      const result = await service.getInvoiceSignedUrl({
        invoiceId: 'pay-1',
        tenantUuid: 'tenant-uuid-1',
      })

      expect(result.url).toBe('https://storage.example.com/signed-url')
    })

    /**
     * Resolved against the tenant's own payments, so an id belonging to someone
     * else is simply absent. A 403 here would confirm that the id exists.
     */
    it("treats another tenant's invoice as missing", async () => {
      const deps = makeDeps()
      deps.paymentRepo.listByTenant = vi.fn().mockResolvedValue([])
      const service = createBillingService(deps)

      await expect(
        service.getInvoiceSignedUrl({ invoiceId: 'pay-elsewhere', tenantUuid: 'tenant-uuid-1' }),
      ).rejects.toThrow(NotFoundError)
      expect(deps.storageAdapter.signedUrl).not.toHaveBeenCalled()
    })

    it('refuses to sign anything for an unsettled charge', async () => {
      const deps = makeDeps()
      deps.paymentRepo.listByTenant = vi
        .fn()
        .mockResolvedValue([makePayment({ id: 'pay-1', status: 'pending' })])
      deps.documentRepo.findByTenantId = vi.fn().mockResolvedValue([makeDocument()])
      const service = createBillingService(deps)

      await expect(
        service.getInvoiceSignedUrl({ invoiceId: 'pay-1', tenantUuid: 'tenant-uuid-1' }),
      ).rejects.toThrow(NotFoundError)
      expect(deps.storageAdapter.signedUrl).not.toHaveBeenCalled()
    })
  })
})
