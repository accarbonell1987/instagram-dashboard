import type { PaymentRepository, OnboardingDraftRepository } from '../repositories/index.js'
import type { PaymentAdapterRegistry, BankAccount } from '../adapters/payment/index.js'
import type { Config } from '../config.js'
import type { Payment, PaymentMethod } from '../domain/index.js'
import { ConflictError, ValidationError } from '../errors.js'

export type PaymentServiceDeps = {
  paymentRepo: PaymentRepository
  draftRepo: OnboardingDraftRepository
  paymentAdapterRegistry: PaymentAdapterRegistry
  config: Config
}

export type PaymentInitiateInstruction =
  | { kind: 'redirect'; redirectUrl: string; expiresAt: Date }
  | { kind: 'bank_transfer'; reference: string; bankAccounts: BankAccount[] }

export type PaymentInitiateResponse = {
  paymentId: string
  instruction: PaymentInitiateInstruction
}

export type PaymentStatusResponse = {
  status: Payment['status']
  confirmedAt: Date | undefined
  paymentId: string | undefined
}

export function createPaymentService(deps: PaymentServiceDeps) {
  const { paymentRepo, draftRepo, paymentAdapterRegistry, config } = deps

  // No method requested and more than one is enabled: initiation is ambiguous —
  // the wizard always sends a method once 2+ are enabled (it shows a picker),
  // so this only fires for a caller that skips the picker. Fail loudly rather
  // than guess, same spirit as the zero-enabled case below.
  async function resolveMethod(requested: PaymentMethod | undefined): Promise<PaymentMethod> {
    if (requested !== undefined) return requested

    const [only, ...rest] = await paymentAdapterRegistry.listEnabledMethods()
    if (only === undefined) {
      throw new ConflictError('payment.no_method_enabled', 'No payment method is currently enabled')
    }
    if (rest.length > 0) {
      throw new ValidationError('payment.method_required', 'Multiple payment methods are enabled — a method must be specified')
    }
    return only
  }

  async function initiatePayment(params: {
    draftId: string
    idempotencyReset: boolean
    method?: PaymentMethod | undefined
  }): Promise<PaymentInitiateResponse> {
    const { draftId, idempotencyReset, method } = params

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

    const resolvedMethod = await resolveMethod(method)
    const adapter = await paymentAdapterRegistry.getEnabledAdapter(resolvedMethod)
    const result = await adapter.initiate({
      amount: resolvedAmount,
      currency: 'PYG',
      draftId,
      returnUrl: config.BANCARD_RETURN_URL,
      description: 'Corehub Plan',
    })

    const payment = await paymentRepo.create({
      draftId,
      externalRef: result.externalRef,
      method: resolvedMethod,
      amount: resolvedAmount,
      currency: 'PYG',
      status: 'pending',
    })

    await draftRepo.update(draftId, { status: 'payment_pending' })

    const instruction: PaymentInitiateInstruction =
      result.kind === 'redirect'
        ? { kind: 'redirect', redirectUrl: result.url, expiresAt: result.expiresAt }
        : { kind: 'bank_transfer', reference: result.reference, bankAccounts: result.accounts }

    return { paymentId: payment.id, instruction }
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
