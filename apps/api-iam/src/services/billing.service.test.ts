import { describe, it, expect, vi } from 'vitest'
import { createBillingService } from './billing.service.js'
import { ForbiddenError, NotFoundError } from '../errors.js'
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
})
