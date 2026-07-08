import { randomUUID } from 'crypto'
import type { DocumentRepository } from '../repositories/index.js'
import type { StorageAdapter } from '../adapters/index.js'
import { ForbiddenError, NotFoundError } from '../errors.js'

export type BillingServiceDeps = {
  documentRepo: DocumentRepository
  storageAdapter: StorageAdapter
}

export function createBillingService(deps: BillingServiceDeps) {
  const { documentRepo, storageAdapter } = deps

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

  return { getSignedDocumentUrl, getPaymentMethod, requestPaymentMethodChange, listInvoices }
}

export type BillingService = ReturnType<typeof createBillingService>
