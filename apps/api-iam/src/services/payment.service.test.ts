import { describe, it, expect, vi } from 'vitest'
import type { OnboardingDraft, Payment } from '../domain/index.js'
import { ConflictError, ValidationError } from '../errors.js'
import { createPaymentService } from './payment.service.js'

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeDraft(overrides: Partial<OnboardingDraft> = {}): OnboardingDraft {
  return {
    id: 'draft-1',
    status: 'otp_verified',
    currentStep: 'company',
    version: 2,
    planId: 'professional',
    data: { plan: { price: 75000 } },
    representativeEmail: 'ana@empresa.com',
    resumeTokenHash: undefined,
    resumeTokenExpiresAt: undefined,
    resumeTokenUsed: false,
    tenantId: undefined,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'payment-1',
    draftId: 'draft-1',
    tenantId: undefined,
    externalRef: 'bancard-proc-1',
    method: 'bancard',
    amount: 75000,
    currency: 'PYG',
    status: 'pending',
    reason: undefined,
    settlementKind: undefined,
    settledBy: undefined,
    settledAt: undefined,
    note: undefined,
    initiatedAt: new Date(),
    confirmedAt: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeConfig() {
  return {
    BANCARD_RETURN_URL: 'http://localhost:3001/onboarding/payment/return',
  }
}

function makeDeps(draftStatus = 'otp_verified' as OnboardingDraft['status']) {
  const draft = makeDraft({ status: draftStatus })

  const draftRepo = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(draft),
    findByIdOrThrow: vi.fn().mockResolvedValue(draft),
    findByIdForUpdate: vi.fn().mockResolvedValue(draft),
    update: vi.fn().mockResolvedValue({ ...draft, status: 'payment_pending' }),
    setResumeToken: vi.fn(),
    markResumeTokenUsed: vi.fn(),
    deleteExpired: vi.fn(),
  }

  const paymentRepo = {
    create: vi.fn().mockResolvedValue(makePayment()),
    findByDraftId: vi.fn().mockResolvedValue(makePayment()),
    findByExternalRef: vi.fn(),
    listByTenant: vi.fn(),
    updateStatus: vi.fn(),
    cancelPendingByDraftId: vi.fn().mockResolvedValue(undefined),
  }

  const bancardMethodAdapter = {
    initiate: vi.fn().mockResolvedValue({
      kind: 'redirect' as const,
      externalRef: 'bancard-proc-1',
      url: 'https://vpos.infonet.com.py/redirect',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    }),
  }

  const paymentAdapterRegistry = {
    getEnabledAdapter: vi.fn().mockResolvedValue(bancardMethodAdapter),
    listEnabledMethods: vi.fn().mockResolvedValue(['bancard']),
  }

  const config = makeConfig()

  return { draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config, draft }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('PaymentService', () => {
  describe('initiatePayment', () => {
    it('IAM-ONB-006.1: happy path — creates payment and calls Bancard once', async () => {
      const { draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } = makeDeps('otp_verified')
      const service = createPaymentService({ draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } as never)

      const result = await service.initiatePayment({ draftId: 'draft-1', idempotencyReset: false })

      expect(bancardMethodAdapter.initiate).toHaveBeenCalledTimes(1)
      expect(bancardMethodAdapter.initiate).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'PYG',
          draftId: 'draft-1',
          description: 'Corehub Plan',
        }),
      )
      expect(paymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ draftId: 'draft-1', status: 'pending' }),
      )
      expect(draftRepo.update).toHaveBeenCalledWith(
        'draft-1',
        expect.objectContaining({ status: 'payment_pending' }),
      )
      expect(paymentAdapterRegistry.getEnabledAdapter).toHaveBeenCalledWith('bancard')
      expect(result).toMatchObject({
        paymentId: 'payment-1',
        instruction: { kind: 'redirect', redirectUrl: expect.any(String), expiresAt: expect.any(Date) },
      })
    })

    it('IAM-ONB-006.4: resolves to the single enabled method when none is requested', async () => {
      const { draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } = makeDeps('otp_verified')
      const service = createPaymentService({ draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } as never)

      await service.initiatePayment({ draftId: 'draft-1', idempotencyReset: false })

      expect(paymentAdapterRegistry.listEnabledMethods).toHaveBeenCalledTimes(1)
      expect(paymentAdapterRegistry.getEnabledAdapter).toHaveBeenCalledWith('bancard')
    })

    it('uses the explicitly requested method without consulting listEnabledMethods', async () => {
      const { draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } = makeDeps('otp_verified')
      const service = createPaymentService({ draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } as never)

      await service.initiatePayment({ draftId: 'draft-1', idempotencyReset: false, method: 'bank_transfer' })

      expect(paymentAdapterRegistry.listEnabledMethods).not.toHaveBeenCalled()
      expect(paymentAdapterRegistry.getEnabledAdapter).toHaveBeenCalledWith('bank_transfer')
    })

    it('throws ConflictError when the requested method is disabled', async () => {
      const { draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } = makeDeps('otp_verified')
      paymentAdapterRegistry.getEnabledAdapter.mockRejectedValueOnce(
        new ConflictError('payment.method_disabled', 'Payment method "bank_transfer" is not enabled'),
      )
      const service = createPaymentService({ draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } as never)

      await expect(
        service.initiatePayment({ draftId: 'draft-1', idempotencyReset: false, method: 'bank_transfer' }),
      ).rejects.toThrow(ConflictError)
    })

    it('throws ConflictError when no payment method is enabled', async () => {
      const { draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } = makeDeps('otp_verified')
      paymentAdapterRegistry.listEnabledMethods.mockResolvedValueOnce([])
      const service = createPaymentService({ draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } as never)

      await expect(
        service.initiatePayment({ draftId: 'draft-1', idempotencyReset: false }),
      ).rejects.toThrow(ConflictError)
    })

    it('throws ValidationError when no method is requested and more than one is enabled', async () => {
      const { draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } = makeDeps('otp_verified')
      paymentAdapterRegistry.listEnabledMethods.mockResolvedValueOnce(['bancard', 'bank_transfer'])
      const service = createPaymentService({ draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } as never)

      await expect(
        service.initiatePayment({ draftId: 'draft-1', idempotencyReset: false }),
      ).rejects.toThrow(ValidationError)
    })

    it('creates the payment with the resolved bank_transfer method and its instruction shape', async () => {
      const { draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } = makeDeps('otp_verified')
      const bankTransferAdapter = {
        initiate: vi.fn().mockResolvedValue({
          kind: 'bank_transfer' as const,
          externalRef: 'CH-7K2M4Q',
          reference: 'CH-7K2M4Q',
          accounts: [{ bankName: 'Banco Itaú', accountType: 'checking' as const, accountNumber: '123', accountHolder: 'Corehub SA' }],
        }),
      }
      paymentAdapterRegistry.getEnabledAdapter.mockResolvedValueOnce(bankTransferAdapter)
      const service = createPaymentService({ draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } as never)

      const result = await service.initiatePayment({ draftId: 'draft-1', idempotencyReset: false, method: 'bank_transfer' })

      expect(paymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'bank_transfer', externalRef: 'CH-7K2M4Q' }),
      )
      expect(result.instruction).toEqual({
        kind: 'bank_transfer',
        reference: 'CH-7K2M4Q',
        bankAccounts: [{ bankName: 'Banco Itaú', accountType: 'checking', accountNumber: '123', accountHolder: 'Corehub SA' }],
      })
    })

    it('IAM-ONB-006.1: also works from payment_pending status', async () => {
      const { draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } = makeDeps('payment_pending')
      const service = createPaymentService({ draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } as never)

      await expect(
        service.initiatePayment({ draftId: 'draft-1', idempotencyReset: false }),
      ).resolves.not.toThrow()
    })

    it('throws ConflictError when payment already approved', async () => {
      const { draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } = makeDeps('payment_confirmed')
      const service = createPaymentService({ draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } as never)

      await expect(
        service.initiatePayment({ draftId: 'draft-1', idempotencyReset: false }),
      ).rejects.toThrow(ConflictError)
    })

    it('throws ValidationError for invalid draft state (draft)', async () => {
      const { draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } = makeDeps('draft')
      const service = createPaymentService({ draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } as never)

      await expect(
        service.initiatePayment({ draftId: 'draft-1', idempotencyReset: false }),
      ).rejects.toThrow(ValidationError)
    })

    it('IAM-ONB-006.3: idempotencyReset=true cancels pending payment before creating new', async () => {
      const { draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } = makeDeps('payment_pending')
      const service = createPaymentService({ draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } as never)

      await service.initiatePayment({ draftId: 'draft-1', idempotencyReset: true })

      expect(paymentRepo.cancelPendingByDraftId).toHaveBeenCalledWith('draft-1')
      expect(bancardMethodAdapter.initiate).toHaveBeenCalledTimes(1)
    })

    it('does NOT cancel pending when idempotencyReset=false', async () => {
      const { draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } = makeDeps('otp_verified')
      const service = createPaymentService({ draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } as never)

      await service.initiatePayment({ draftId: 'draft-1', idempotencyReset: false })

      expect(paymentRepo.cancelPendingByDraftId).not.toHaveBeenCalled()
    })
  })

  describe('getPaymentStatus', () => {
    it('IAM-ONB-007.1: returns approved status when webhook arrived', async () => {
      const { draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } = makeDeps()
      paymentRepo.findByDraftId.mockResolvedValue(
        makePayment({ status: 'approved', confirmedAt: new Date() }),
      )
      const service = createPaymentService({ draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } as never)

      const result = await service.getPaymentStatus('draft-1')

      expect(result.status).toBe('approved')
      expect(result.confirmedAt).toBeInstanceOf(Date)
      expect(result.paymentId).toBe('payment-1')
    })

    it('IAM-ONB-007.2: returns pending status when webhook not yet arrived', async () => {
      const { draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } = makeDeps()
      paymentRepo.findByDraftId.mockResolvedValue(makePayment({ status: 'pending' }))
      const service = createPaymentService({ draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } as never)

      const result = await service.getPaymentStatus('draft-1')

      expect(result.status).toBe('pending')
      expect(result.confirmedAt).toBeUndefined()
    })

    it('returns pending when no payment record found', async () => {
      const { draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } = makeDeps()
      paymentRepo.findByDraftId.mockResolvedValue(null)
      const service = createPaymentService({ draftRepo, paymentRepo, paymentAdapterRegistry, bancardMethodAdapter, config } as never)

      const result = await service.getPaymentStatus('draft-1')

      expect(result.status).toBe('pending')
      expect(result.paymentId).toBeUndefined()
    })
  })
})
