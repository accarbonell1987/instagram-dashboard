import { apiFetchWithInterceptors } from '@/lib/api/interceptors';
import type { components } from '@/lib/api/types';

// ─── Types ──────────────────────────────────────────────────────────────────────

export type AdminPayment = components['schemas']['Payment'];
export type AdminPaymentListResponse = components['schemas']['PaymentListResponse'];
export type AdminPaymentStatus = AdminPayment['status'];

/**
 * Statuses the backend still accepts a settlement for — mirrors UNSETTLED_STATUSES
 * in api-iam's settlement.service.ts. `declined` belongs here: a rejected transfer
 * keeps its reference so the customer can retry, and the agent confirms that same
 * payment once it clears.
 *
 * Deliberately missing `in_review`, which the backend accepts but the published
 * contract does not declare. api-contract.yaml still carries the pre-bank-transfer
 * PaymentStatus set: it lacks `in_review` and `reversed` and declares a `timeout`
 * the database never had. Add the missing members here once the contract is
 * corrected — until then this list cannot name a status the generated types reject.
 */
export const SETTLEABLE_STATUSES: readonly AdminPaymentStatus[] = ['pending', 'declined'];

export function isSettleable(status: AdminPaymentStatus): boolean {
  return SETTLEABLE_STATUSES.includes(status);
}
export type PaymentMethodKind = components['schemas']['PaymentMethodKind'];
export type AdminPaymentMethodConfig = components['schemas']['PaymentMethodConfig'];
export type AdminPaymentMethodConfigListResponse =
  components['schemas']['PaymentMethodConfigListResponse'];

export interface ListAdminPaymentsParams {
  status?: AdminPaymentStatus | undefined;
  tenantId?: string | undefined;
  reference?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export interface ListTenantPaymentsParams {
  page?: number | undefined;
  pageSize?: number | undefined;
}

// ─── Service functions ──────────────────────────────────────────────────────────

export async function listAdminPayments(
  params?: ListAdminPaymentsParams
): Promise<AdminPaymentListResponse> {
  const query = new URLSearchParams();
  if (params?.status !== undefined) query.set('status', params.status);
  if (params?.tenantId !== undefined) query.set('tenantId', params.tenantId);
  if (params?.reference !== undefined) query.set('reference', params.reference);
  if (params?.page !== undefined) query.set('page', String(params.page));
  if (params?.pageSize !== undefined) query.set('pageSize', String(params.pageSize));
  const qs = query.size > 0 ? `?${query.toString()}` : '';

  return apiFetchWithInterceptors<AdminPaymentListResponse>(`/admin/payments${qs}`, {
    method: 'GET',
  });
}

export async function confirmPayment(id: string, note: string): Promise<AdminPayment> {
  return apiFetchWithInterceptors<AdminPayment>(`/admin/payments/${id}/confirm`, {
    method: 'POST',
    body: { note },
  });
}

export async function rejectPayment(id: string, note: string): Promise<AdminPayment> {
  return apiFetchWithInterceptors<AdminPayment>(`/admin/payments/${id}/reject`, {
    method: 'POST',
    body: { note },
  });
}

export async function listPaymentMethods(): Promise<AdminPaymentMethodConfigListResponse> {
  return apiFetchWithInterceptors<AdminPaymentMethodConfigListResponse>(
    '/admin/payment-methods',
    { method: 'GET' }
  );
}

export async function updatePaymentMethod(
  method: PaymentMethodKind,
  enabled: boolean
): Promise<AdminPaymentMethodConfig> {
  return apiFetchWithInterceptors<AdminPaymentMethodConfig>(`/admin/payment-methods/${method}`, {
    method: 'PATCH',
    body: { enabled },
  });
}

export async function listTenantPayments(
  tenantId: string,
  params?: ListTenantPaymentsParams
): Promise<AdminPaymentListResponse> {
  const query = new URLSearchParams();
  if (params?.page !== undefined) query.set('page', String(params.page));
  if (params?.pageSize !== undefined) query.set('pageSize', String(params.pageSize));
  const qs = query.size > 0 ? `?${query.toString()}` : '';

  return apiFetchWithInterceptors<AdminPaymentListResponse>(
    `/admin/tenants/${tenantId}/payments${qs}`,
    { method: 'GET' }
  );
}
