import type { Payment, PaymentSettlementKind, PaymentStatus } from '../domain/index.js'

// Map domain PaymentStatus (has 'reversed') → contract's Payment status enum
// (pending/in_review/approved/declined/cancelled/timeout). Mirrors the mapper
// already used for the draft's nested payment status
// (routes/onboarding/index.ts:mapPaymentStatus) — 'in_review' passes through
// unchanged so the backoffice payments queue's "Awaiting review" filter works.
export function mapPaymentStatus(
  status: PaymentStatus,
): 'pending' | 'in_review' | 'approved' | 'declined' | 'cancelled' | 'timeout' {
  if (status === 'reversed') return 'timeout'
  return status
}

// Map domain PaymentStatus → the contract's InvoiceStatus.
//
// An invoice is the fiscal face of a payment: what was charged, and whether it
// was settled. `in_review` reads as pending because the tenant has been billed
// and the money has not been accepted yet — from their side it is unpaid.
// Every terminal non-approval collapses to `cancelled`: the distinction between
// declined, cancelled and reversed is operational, and lives in the payment
// log, not on a fiscal document.
//
// `overdue` is never produced. Nothing in the system carries a due date, so
// there is no moment at which an invoice could become late. Emitting it would
// be a guess dressed as a fact.
const INVOICE_STATUS_MAP: Record<PaymentStatus, 'paid' | 'pending' | 'cancelled'> = {
  pending: 'pending',
  in_review: 'pending',
  approved: 'paid',
  declined: 'cancelled',
  cancelled: 'cancelled',
  reversed: 'cancelled',
}

/**
 * Reshape a payment into the contract's InvoiceListItem.
 *
 * `documentId` is the tenant's invoice PDF once settlement has generated it,
 * and null until then — the frontend renders a dash rather than a dead
 * download button. The same document is attached to every row because the
 * system issues one invoice per tenant today; a payment that predates it, or
 * never settled, simply has nothing to download.
 */
export function toInvoiceListItem(payment: Payment, documentId: string | null) {
  return {
    id: payment.id,
    // The date the charge became real for the customer. confirmedAt is when the
    // money landed; without it the payment is still open, so the date it was
    // initiated is the only honest answer.
    issuedAt: (payment.confirmedAt ?? payment.createdAt).toISOString(),
    total: payment.amount,
    currency: payment.currency as 'PYG' | 'USD',
    status: INVOICE_STATUS_MAP[payment.status],
    documentId,
  }
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
