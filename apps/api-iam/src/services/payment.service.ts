import type { PaymentRepository, OnboardingDraftRepository } from '../repositories/index.js'
import type { BancardAdapter } from '../adapters/index.js'
import type { Config } from '../config.js'
import type { Payment } from '../domain/index.js'
import { ConflictError, ValidationError } from '../errors.js'

export type PaymentServiceDeps = {
  paymentRepo: PaymentRepository
  draftRepo: OnboardingDraftRepository
  bancardAdapter: BancardAdapter
  config: Config
}

export type PaymentInitiateResponse = {
  paymentId: string
  bancardProcessId: string
  redirectUrl: string
  expiresAt: Date
}

export type PaymentStatusResponse = {
  status: Payment['status']
  confirmedAt: Date | undefined
  paymentId: string | undefined
}

export function createPaymentService(deps: PaymentServiceDeps) {
  const { paymentRepo, draftRepo, bancardAdapter, config } = deps

  async function initiatePayment(params: {
    draftId: string
    idempotencyReset: boolean
  }): Promise<PaymentInitiateResponse> {
    const { draftId, idempotencyReset } = params

    const draft = await draftRepo.findByIdOrThrow(draftId)

    if (draft.status === 'payment_confirmed') {
      throw new ConflictError('onboarding.payment_already_approved')
    }

    if (draft.status !== 'otp_verified' && draft.status !== 'payment_pending') {
      throw new ValidationError(
        'onboarding.invalid_draft_state',
        `Draft must be in otp_verified or payment_pending status to initiate payment, got: ${draft.status}`,
      )
    }

    if (idempotencyReset) {
      await paymentRepo.cancelPendingByDraftId(draftId)
    }

    const amount = 50000 // Default fallback; real amount comes from plan data
    const planData = draft.data['plan'] as Record<string, unknown> | undefined
    const resolvedAmount =
      typeof planData?.['price'] === 'number' ? planData['price'] : amount

    const result = await bancardAdapter.initiatePayment({
      amount: resolvedAmount,
      currency: 'PYG',
      draftId,
      returnUrl: config.BANCARD_RETURN_URL,
      description: 'Corehub Plan',
    })

    const payment = await paymentRepo.create({
      draftId,
      bancardProcessId: result.processId,
      amount: resolvedAmount,
      currency: 'PYG',
      status: 'pending',
    })

    await draftRepo.update(draftId, { status: 'payment_pending' })

    return {
      paymentId: payment.id,
      bancardProcessId: result.processId,
      redirectUrl: result.redirectUrl,
      expiresAt: result.expiresAt,
    }
  }

  async function getPaymentStatus(draftId: string): Promise<PaymentStatusResponse> {
    const payment = await paymentRepo.findByDraftId(draftId)

    return {
      status: payment?.status ?? 'pending',
      confirmedAt: payment?.confirmedAt,
      paymentId: payment?.id,
    }
  }

  return {
    initiatePayment,
    getPaymentStatus,
  }
}

export type PaymentService = ReturnType<typeof createPaymentService>
