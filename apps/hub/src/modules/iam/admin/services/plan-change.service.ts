import { apiFetchWithInterceptors } from '@/lib/api/interceptors';
import type { components } from '@/lib/api/types';

type PlanChangeResponse = components['schemas']['PlanChangeResponse'];

export async function requestPlanChange(toPlanId: string): Promise<PlanChangeResponse> {
  return apiFetchWithInterceptors<PlanChangeResponse>('/tenants/current/plan-change', {
    method: 'POST',
    body: { toPlanId },
  });
}
