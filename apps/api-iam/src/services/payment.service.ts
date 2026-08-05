import type { PaymentRepository, OnboardingDraftRepository } from '../repositories/index.js'
import type { PaymentAdapterRegistry } from '../adapters/payment/index.js'
import type { Config } from '../config.js'
import type { Payment } from '../domain/index.js'
import { ConflictError, InternalError, ValidationError } from '../errors.js'

export type PaymentServiceDeps = {
  paymentRepo: PaymentRepository
  draftRepo: OnboardingDraftRepository
  paymentAdapterRegistry: PaymentAdapterRegistry
  config: Config
}

export type PaymentInitiateResponse = {
  paymentId: string
  externalRef: string
  redirectUrl: string
  expiresAt: Date
}

export type PaymentStatusResponse = {
  status: Payment['status']
  confirmedAt: Date | undefined
  paymentId: string | undefined
}

export function createPaymentService(deps: PaymentServiceDeps) {
  const { paymentRepo, draftRepo, paymentAdapterRegistry, config } = deps

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

    // Method selection isn't wired to this endpoint yet (no UI offers a choice —
    // that's step-5-payment/bank-transfer-view.tsx, a separate slice). Bancard
    // is the only method this route drives today; `bank_transfer` stays reachable
    // only through the registry directly (see adapters/payment/index.ts).
    const adapter = await paymentAdapterRegistry.getEnabledAdapter('bancard')
    const instruction = await adapter.initiate({
      amount: resolvedAmount,
      currency: 'PYG',
      draftId,
      returnUrl: config.BANCARD_RETURN_URL,
      description: 'Corehub Plan',
    })

    // The onboarding contract's PaymentInitiateResponse is still the flat
    // Bancard-only shape — it doesn't yet expose PaymentInstruction's
    // discriminated union. Since this route only ever drives 'bancard' today,
    // this is defensive, not reachable in practice.
    if (instruction.kind !== 'redirect') {
      throw new InternalError(
        'payment.unsupported_instruction_kind',
        `Route does not support "${instruction.kind}" instructions yet — requires an api-contract.yaml update`,
      )
    }

    const payment = await paymentRepo.create({
      draftId,
      externalRef: instruction.externalRef,
      amount: resolvedAmount,
      currency: 'PYG',
      status: 'pending',
    })

    await draftRepo.update(draftId, { status: 'payment_pending' })

    return {
      paymentId: payment.id,
      externalRef: instruction.externalRef,
      redirectUrl: instruction.url,
      expiresAt: instruction.expiresAt,
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
