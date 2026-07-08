import { describe, it, expect, vi } from 'vitest'
import { createHmac } from 'crypto'
import type { Payment, OnboardingDraft } from '../domain/index.js'
import { UnauthorizedError } from '../errors.js'
import { createWebhookService } from './webhook.service.js'

// ─── Helpers ───────────────────────────────────────────────────────────────

const TEST_SECRET = 'super-secret-webhook-key-at-least-16-chars'

function makeSignature(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}

function makePayload(overrides: Partial<{
  process_id: string
  status: string
  response_code: string
  response_description: string
  amount: number
  authorization_number: string
  operation_date: string
}> = {}) {
  return {
    process_id: 'proc-1',
    status: 'approved',
    response_code: '00',
    response_description: 'Approved',
    amount: 75000,
    authorization_number: 'AUTH-123',
    operation_date: new Date().toISOString(),
    ...overrides,
  }
}

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'payment-1',
    draftId: 'draft-1',
    tenantId: undefined,
    bancardProcessId: 'proc-1',
    amount: 75000,
    currency: 'PYG',
    status: 'pending',
    reason: undefined,
    initiatedAt: new Date(),
    confirmedAt: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeConfig() {
  return {
    BANCARD_WEBHOOK_SECRET: TEST_SECRET,
  }
}

function makeDeps() {
  const webhookEventRepo = {
    insertEvent: vi.fn().mockResolvedValue(true),
  }

  const paymentRepo = {
    create: vi.fn(),
    findByDraftId: vi.fn(),
    findByBancardProcessId: vi.fn().mockResolvedValue(makePayment()),
    updateStatus: vi.fn().mockResolvedValue(makePayment({ status: 'approved' })),
    cancelPendingByDraftId: vi.fn(),
  }

  const draftRepo = {
    findByIdOrThrow: vi.fn(),
    findById: vi.fn(),
    findByIdForUpdate: vi.fn(),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
    setResumeToken: vi.fn(),
    markResumeTokenUsed: vi.fn(),
    deleteExpired: vi.fn(),
  }

  const prisma = {
    $transaction: vi.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn({
      $executeRaw: vi.fn().mockResolvedValue(1), // 1 = row inserted (new webhook)
    })),
  }

  const config = makeConfig()

  return { webhookEventRepo, paymentRepo, draftRepo, prisma, config }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('WebhookService', () => {
  describe('processBancardWebhook', () => {
    it('IAM-WEB-001.1: throws UnauthorizedError when signature is invalid', async () => {
      const deps = makeDeps()
      const service = createWebhookService(deps as never)
      const payload = makePayload()
      const rawBody = JSON.stringify(payload)

      await expect(
        service.processBancardWebhook({
          rawBody,
          signature: 'totally-wrong-signature-value',
          payload,
        }),
      ).rejects.toThrow(UnauthorizedError)

      // Transaction should NOT have been opened
      expect(deps.prisma.$transaction).not.toHaveBeenCalled()
    })

    it('IAM-WEB-002.1: approved webhook updates payment and draft', async () => {
      const deps = makeDeps()
      const service = createWebhookService(deps as never)

      // Set up transaction mock to call the function with a tx that has $executeRaw returning 1 (new)
      deps.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $executeRaw: vi.fn().mockResolvedValue(1),
        }
        return fn(tx)
      })

      const payload = makePayload({ status: 'approved' })
      const rawBody = JSON.stringify(payload)
      const signature = makeSignature(TEST_SECRET, rawBody)

      const result = await service.processBancardWebhook({ rawBody, signature, payload })

      expect(result).toEqual({ received: true })
      expect(deps.paymentRepo.findByBancardProcessId).toHaveBeenCalledWith('proc-1')
      expect(deps.paymentRepo.updateStatus).toHaveBeenCalledWith('payment-1', 'approved', expect.any(Date))
      expect(deps.draftRepo.update).toHaveBeenCalledWith(
        'draft-1',
        expect.objectContaining({ status: 'payment_confirmed' }),
      )
    })

    it('IAM-WEB-002.2: duplicate webhook (isNew=0) does not update payment or draft', async () => {
      const deps = makeDeps()
      const service = createWebhookService(deps as never)

      // Transaction mock: $executeRaw returns 0 (conflict — already exists)
      deps.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $executeRaw: vi.fn().mockResolvedValue(0),
        }
        return fn(tx)
      })

      const payload = makePayload({ status: 'approved' })
      const rawBody = JSON.stringify(payload)
      const signature = makeSignature(TEST_SECRET, rawBody)

      const result = await service.processBancardWebhook({ rawBody, signature, payload })

      expect(result).toEqual({ received: true })
      // No payment or draft update on duplicate
      expect(deps.paymentRepo.updateStatus).not.toHaveBeenCalled()
      expect(deps.draftRepo.update).not.toHaveBeenCalled()
    })

    it('IAM-WEB-002.3: rejected payment sets status=declined, does not update draft', async () => {
      const deps = makeDeps()
      const service = createWebhookService(deps as never)

      deps.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = { $executeRaw: vi.fn().mockResolvedValue(1) }
        return fn(tx)
      })

      const payload = makePayload({ status: 'rejected' })
      const rawBody = JSON.stringify(payload)
      const signature = makeSignature(TEST_SECRET, rawBody)

      await service.processBancardWebhook({ rawBody, signature, payload })

      expect(deps.paymentRepo.updateStatus).toHaveBeenCalledWith('payment-1', 'declined')
      // Draft should NOT be updated for rejected payment
      expect(deps.draftRepo.update).not.toHaveBeenCalled()
    })

    it('reversed payment sets status=declined', async () => {
      const deps = makeDeps()
      const service = createWebhookService(deps as never)

      deps.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = { $executeRaw: vi.fn().mockResolvedValue(1) }
        return fn(tx)
      })

      const payload = makePayload({ status: 'reversed' })
      const rawBody = JSON.stringify(payload)
      const signature = makeSignature(TEST_SECRET, rawBody)

      await service.processBancardWebhook({ rawBody, signature, payload })

      expect(deps.paymentRepo.updateStatus).toHaveBeenCalledWith('payment-1', 'declined')
    })

    it('unknown process_id is a no-op (payment not found)', async () => {
      const deps = makeDeps()
      deps.paymentRepo.findByBancardProcessId.mockResolvedValue(null)
      const service = createWebhookService(deps as never)

      deps.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = { $executeRaw: vi.fn().mockResolvedValue(1) }
        return fn(tx)
      })

      const payload = makePayload({ process_id: 'unknown-process-id' })
      const rawBody = JSON.stringify(payload)
      const signature = makeSignature(TEST_SECRET, rawBody)

      const result = await service.processBancardWebhook({ rawBody, signature, payload })

      expect(result).toEqual({ received: true })
      expect(deps.paymentRepo.updateStatus).not.toHaveBeenCalled()
      expect(deps.draftRepo.update).not.toHaveBeenCalled()
    })
  })
})
