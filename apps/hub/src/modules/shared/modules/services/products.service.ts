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
