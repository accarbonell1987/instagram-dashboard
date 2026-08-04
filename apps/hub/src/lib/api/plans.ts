import { apiFetchWithInterceptors } from '@/lib/api/interceptors';
import type { components } from '@/lib/api/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Plan = components['schemas']['Plan'];

export interface ListPlansResult {
  plans: Plan[];
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function listPlans(productId?: string): Promise<ListPlansResult> {
  const qs = productId !== undefined ? `?productId=${encodeURIComponent(productId)}` : '';
  return apiFetchWithInterceptors<ListPlansResult>(`/plans${qs}`, { method: 'GET' });
}

export async function getPlan(planId: string): Promise<Plan> {
  return apiFetchWithInterceptors<Plan>(`/plans/${planId}`, { method: 'GET' });
}
