import { apiFetchWithInterceptors } from '@/lib/api/interceptors';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface AdminProduct {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  /** Whether this product may be offered as a trial at all. */
  trialEnabled: boolean;
  /** Default length used when granting or resetting a trial. */
  trialDurationDays: number;
}

export interface TrialEntry {
  id: string;
  tenantId: string;
  productId: string;
  moduleId: string | null;
  moduleName: string | null;
  createdAt: string;
  expiresAt: string | null;
  remainingDays: number | null;
  consumedDays: number | null;
}

export interface GrantTrialParams {
  productId: string;
  /** Omit for a whole-product trial; set it to scope the trial to one module. */
  moduleId?: string | undefined;
  durationDays?: number | undefined;
}

// ─── Products ───────────────────────────────────────────────────────────────────

export async function listProducts(): Promise<AdminProduct[]> {
  const response = await apiFetchWithInterceptors<{ products: AdminProduct[] }>('/admin/products', {
    method: 'GET',
  });
  return response.products;
}

export async function updateProduct(
  productId: string,
  patch: Partial<Pick<AdminProduct, 'name' | 'description' | 'active' | 'trialEnabled' | 'trialDurationDays'>>
): Promise<AdminProduct> {
  return apiFetchWithInterceptors<AdminProduct>(`/admin/products/${productId}`, {
    method: 'PATCH',
    body: patch,
  });
}

// ─── Trials ─────────────────────────────────────────────────────────────────────

export async function listTrials(productId?: string): Promise<TrialEntry[]> {
  const qs = productId !== undefined ? `?productId=${encodeURIComponent(productId)}` : '';
  const response = await apiFetchWithInterceptors<{ trials: TrialEntry[] }>(`/admin/trials${qs}`, {
    method: 'GET',
  });
  return response.trials;
}

export async function grantTrial(tenantId: string, params: GrantTrialParams): Promise<void> {
  await apiFetchWithInterceptors(`/admin/tenants/${tenantId}/trials`, {
    method: 'POST',
    body: params,
  });
}

export async function resetTrial(entitlementId: string): Promise<void> {
  await apiFetchWithInterceptors(`/admin/trials/${entitlementId}/reset`, { method: 'POST' });
}

export async function extendTrial(entitlementId: string, days: number): Promise<void> {
  await apiFetchWithInterceptors(`/admin/trials/${entitlementId}/extend`, {
    method: 'POST',
    body: { days },
  });
}
