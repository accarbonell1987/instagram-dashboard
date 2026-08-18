import { randomUUID } from 'crypto'
import type { DocumentRepository, PaymentRepository } from '../repositories/index.js'
import type { StorageAdapter } from '../adapters/index.js'
import { toContractPayment } from '../lib/payment-mapper.js'
import { ConflictError, ForbiddenError, NotFoundError } from '../errors.js'

export type BillingServiceDeps = {
  documentRepo: DocumentRepository
  storageAdapter: StorageAdapter
  paymentRepo: PaymentRepository
}

/**
 * The tenant's invoice PDF, if settlement has produced it.
 *
 * submit.service creates the row as a `pending` placeholder with a storageKey
 * of 'pending' — you don't invoice what hasn't been paid — so a row existing is
 * not the same as a file existing.
 */
function readyInvoiceDocumentId(
  documents: { id: string; type: string; status: string }[],
): string | null {
  return documents.find((doc) => doc.type === 'invoice' && doc.status === 'ready')?.id ?? null
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

    // Invoices are placeholder rows (status: 'pending') until settlement generates
    // the real PDF — see submit.service.ts / settlement.service.ts.
    if (document.status !== 'ready') {
      throw new ConflictError('billing.document_not_ready', `Document ${documentId} is not ready yet`)
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

  // ponytail: paginates in-memory over listByTenant — this list is scoped to
  // one tenant's payments (small, not a system-wide table scan) and adding a
  // DB-paginated repo method isn't justified yet. Revisit if a tenant
  // accumulates hundreds of payments.
  async function listPayments(params: {
    tenantUuid: string
    page: number
    pageSize: number
  }): Promise<{
    items: (ReturnType<typeof toContractPayment> & { documentId: string | null })[]
    total: number
    page: number
    pageSize: number
  }> {
    const { tenantUuid, page, pageSize } = params
    const [all, documents] = await Promise.all([
      paymentRepo.listByTenant(tenantUuid),
      documentRepo.findByTenantId(tenantUuid),
    ])

    // The invoice PDF, attached to the charge it belongs to. There is no
    // invoicing subsystem — nothing issues documents on a cycle — so the
    // payment carries its own receipt and the customer reads one list, not two.
    const documentId = readyInvoiceDocumentId(documents)
    const start = (page - 1) * pageSize

    return {
      items: all.slice(start, start + pageSize).map((p) => ({
        ...toContractPayment(p),
        // Only a settled charge has a document, and only once settlement has
        // actually generated the file — submit.service creates the row as a
        // placeholder, so a row existing is not a file existing.
        documentId: p.status === 'approved' ? documentId : null,
      })),
      total: all.length,
      page,
      pageSize,
    }
  }

  return { getSignedDocumentUrl, getPaymentMethod, requestPaymentMethodChange, listPayments }
}

export type BillingService = ReturnType<typeof createBillingService>
