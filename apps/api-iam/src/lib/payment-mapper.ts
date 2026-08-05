import type { Payment, PaymentSettlementKind, PaymentStatus } from '../domain/index.js'

// Map domain PaymentStatus (has 'in_review'/'reversed') → contract's Payment
// status enum (pending/approved/declined/cancelled/timeout). Mirrors the
// mapper already used for the draft's nested payment status
// (routes/onboarding/index.ts:mapPaymentStatus) — 'in_review' has no live
// caller yet (no route sets it), mapped to 'pending' as the closest fit.
export function mapPaymentStatus(
  status: PaymentStatus,
): 'pending' | 'approved' | 'declined' | 'cancelled' | 'timeout' {
  if (status === 'reversed') return 'timeout'
  if (status === 'in_review') return 'pending'
  return status
}

const SETTLEMENT_KIND_MAP: Record<PaymentSettlementKind, 'webhook' | 'agent' | 'manual_admin'> = {
  gateway_webhook: 'webhook',
  agent_review: 'agent',
  manual_admin: 'manual_admin',
}

export function mapSettlementKind(
  kind: PaymentSettlementKind | undefined,
): 'webhook' | 'agent' | 'manual_admin' | null {
  return kind ? SETTLEMENT_KIND_MAP[kind] : null
}

// Reshape a domain Payment into the contract's Payment schema.
//
// ponytail: `tenantId` is required by the contract but `Payment.tenantId` is
// still nullable in the schema (submit.service.ts backfills it once a draft
// is submitted). A payment initiated for a draft that never reaches submit
// stays orphaned forever, so this fallback to '' guards the single-resource
// confirm/reject responses; list endpoints filter those rows out entirely
// (see routes/admin/payments.ts).
export function toContractPayment(payment: Payment, tenantName?: string) {
  return {
    id: payment.id,
    tenantId: payment.tenantId ?? '',
    ...(tenantName !== undefined && { tenantName }),
    method: payment.method,
    status: mapPaymentStatus(payment.status),
    settlementKind: mapSettlementKind(payment.settlementKind),
    reference: payment.externalRef,
    amount: payment.amount,
    currency: payment.currency,
    note: payment.note ?? null,
    settledBy: payment.settledBy ?? null,
    settledAt: payment.settledAt ? payment.settledAt.toISOString() : null,
    instruction: null,
    createdAt: payment.createdAt.toISOString(),
  }
}
