import { randomUUID } from 'crypto'
import type { DocumentRepository, PaymentRepository } from '../repositories/index.js'
import type { StorageAdapter } from '../adapters/index.js'
import { toContractPayment } from '../lib/payment-mapper.js'
import { ForbiddenError, NotFoundError } from '../errors.js'

export type BillingServiceDeps = {
  documentRepo: DocumentRepository
  storageAdapter: StorageAdapter
  paymentRepo: PaymentRepository
}

export function createBillingService(deps: BillingServiceDeps) {
  const { documentRepo, storageAdapter, paymentRepo } = deps

  async function getSignedDocumentUrl(params: {
    documentId: string
    tenantUuid: string
  }): Promise<{ url: string; expiresAt: Date }> {
    const { documentId, tenantUuid } = params

    const document = await documentRepo.findById(documentId)

    if (!document) {
      throw new NotFoundError('billing.document_not_found')
    }

    if (document.tenantId !== tenantUuid) {
      throw new ForbiddenError('auth.forbidden')
    }

    const url = await storageAdapter.signedUrl({ key: document.storageKey, ttlSeconds: 300 })

    return {
      url,
      expiresAt: new Date(Date.now() + 300_000),
    }
  }

  async function getPaymentMethod(): Promise<{ paymentMethod: null }> {
    return { paymentMethod: null }
  }

  async function requestPaymentMethodChange(): Promise<{ id: string }> {
    return { id: randomUUID() }
  }

  async function listInvoices(params: {
    page: number
    pageSize: number
  }): Promise<{ items: []; total: number; page: number; pageSize: number }> {
    return { items: [], total: 0, page: params.page, pageSize: params.pageSize }
  }

  // ponytail: paginates in-memory over listByTenant — this list is scoped to
  // one tenant's payments (small, not a system-wide table scan) and adding a
  // DB-paginated repo method isn't justified yet. Revisit if a tenant
  // accumulates hundreds of payments.
  async function listPayments(params: {
    tenantUuid: string
    page: number
    pageSize: number
  }): Promise<{ items: ReturnType<typeof toContractPayment>[]; total: number; page: number; pageSize: number }> {
    const { tenantUuid, page, pageSize } = params
    const all = await paymentRepo.listByTenant(tenantUuid)
    const start = (page - 1) * pageSize
    return {
      items: all.slice(start, start + pageSize).map((p) => toContractPayment(p)),
      total: all.length,
      page,
      pageSize,
    }
  }

  return { getSignedDocumentUrl, getPaymentMethod, requestPaymentMethodChange, listInvoices, listPayments }
}

export type BillingService = ReturnType<typeof createBillingService>
