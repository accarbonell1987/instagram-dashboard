import type { components } from '@/lib/api/types';
import { apiFetchWithInterceptors } from '@/lib/api/interceptors';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Plan = components['schemas']['Plan'];

export type ListPlansResult = {
  plans: Plan[];
};

// ─── Service functions ────────────────────────────────────────────────────────

export async function listPlans(): Promise<ListPlansResult> {
  return apiFetchWithInterceptors<ListPlansResult>('/plans', { method: 'GET' });
}

export async function getPlan(planId: string): Promise<Plan> {
  return apiFetchWithInterceptors<Plan>(`/plans/${planId}`, { method: 'GET' });
}
