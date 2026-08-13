import { apiFetchWithInterceptors } from '@/lib/api/interceptors';
import type { components } from '@/lib/api/types';

export type ProductModule = components['schemas']['ProductModule'];
export type AvailableProduct = components['schemas']['AvailableProduct'];

export async function getAvailableProducts(): Promise<AvailableProduct[]> {
  const response = await apiFetchWithInterceptors<{ products: AvailableProduct[] }>(
    '/tenants/current/products'
  );
  return response.products;
}

// ─── Admin sections contributed by products ────────────────────────────────────

export type TenantAdminSection = components['schemas']['TenantAdminSection'];

/**
 * The settings screens the tenant's own products contribute.
 *
 * Separate from getAvailableProducts on purpose: that one runs on every portal
 * load for the launcher, and settings data has no business riding along.
 */
export async function getTenantAdminSections(): Promise<TenantAdminSection[]> {
  const response = await apiFetchWithInterceptors<
    components['schemas']['TenantAdminSectionsResponse']
  >('/tenants/current/admin-sections', { method: 'GET' });
  return response.sections;
}
