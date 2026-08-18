import { apiFetchWithInterceptors } from '@/lib/api/interceptors';
import type { components } from '@/lib/api/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type PaymentMethodResponse = components['schemas']['PaymentMethodResponse'];
type PaymentMethodChangeRequestResponse = components['schemas']['PaymentMethodChangeRequestResponse'];
type PaymentListResponse = components['schemas']['PaymentListResponse'];

// ─── Service functions ────────────────────────────────────────────────────────

export async function getPaymentMethod(): Promise<PaymentMethodResponse> {
  return apiFetchWithInterceptors<PaymentMethodResponse>('/billing/payment-method', {
    method: 'GET',
  });
}

export async function requestPaymentMethodChange(): Promise<PaymentMethodChangeRequestResponse> {
  return apiFetchWithInterceptors<PaymentMethodChangeRequestResponse>('/billing/payment-method', {
    method: 'POST',
  });
}

/**
 * The tenant's ledger: every charge, with the invoice PDF on the ones that
 * settled. There is no separate invoice list — a payment and its receipt are
 * one row, because they are one event.
 */
export async function listTenantPayments(params?: {
  page?: number;
  pageSize?: number;
}): Promise<PaymentListResponse> {
  const query = new URLSearchParams();
  if (params?.page !== undefined) query.set('page', String(params.page));
  if (params?.pageSize !== undefined) query.set('pageSize', String(params.pageSize));
  const qs = query.size > 0 ? `?${query.toString()}` : '';
  return apiFetchWithInterceptors<PaymentListResponse>(`/billing/payments${qs}`, {
    method: 'GET',
  });
}
