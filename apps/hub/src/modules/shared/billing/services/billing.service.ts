import { apiFetchWithInterceptors } from '@/lib/api/interceptors';
import type { components } from '@/lib/api/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type PaymentMethodResponse = components['schemas']['PaymentMethodResponse'];
type PaymentMethodChangeRequestResponse = components['schemas']['PaymentMethodChangeRequestResponse'];
type InvoiceListResponse = components['schemas']['InvoiceListResponse'];
type SignedUrlResponse = components['schemas']['SignedUrlResponse'];

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

export async function listInvoices(params?: {
  page?: number;
  pageSize?: number;
}): Promise<InvoiceListResponse> {
  const query = new URLSearchParams();
  if (params?.page !== undefined) query.set('page', String(params.page));
  if (params?.pageSize !== undefined) query.set('pageSize', String(params.pageSize));
  const qs = query.size > 0 ? `?${query.toString()}` : '';
  return apiFetchWithInterceptors<InvoiceListResponse>(`/billing/invoices${qs}`, {
    method: 'GET',
  });
}

export async function getInvoiceSignedUrl(invoiceId: string): Promise<SignedUrlResponse> {
  return apiFetchWithInterceptors<SignedUrlResponse>(
    `/billing/invoices/${invoiceId}/signed-url`,
    { method: 'GET' }
  );
}
