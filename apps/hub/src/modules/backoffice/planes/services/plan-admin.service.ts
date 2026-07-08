import { apiFetchWithInterceptors } from '@/lib/api/interceptors'

// ─── Types ──────────────────────────────────────────────────────────────────────

export type AdminPlan = {
  id: string
  name: string
  description?: string
  price: number
  currency: string
  billingInterval: string
  active: boolean
  tenantCount: number
  createdAt: string
  updatedAt: string
}

export type AdminPlanListResponse = {
  plans: AdminPlan[]
}

export type CreatePlanParams = {
  name: string
  description?: string | undefined
  price: number
  currency: string
  billingInterval: string
}

export type UpdatePlanParams = {
  name?: string | undefined
  description?: string | undefined
  price?: number | undefined
  currency?: string | undefined
  billingInterval?: string | undefined
  active?: boolean | undefined
}

// ─── Service functions ──────────────────────────────────────────────────────────

export async function listPlans(filter?: {
  active?: boolean
}): Promise<AdminPlanListResponse> {
  const query = new URLSearchParams()
  if (filter?.active !== undefined) {
    query.set('active', String(filter.active))
  }
  const qs = query.size > 0 ? `?${query.toString()}` : ''

  return apiFetchWithInterceptors<AdminPlanListResponse>(`/admin/plans${qs}`, {
    method: 'GET',
  })
}

export async function createPlan(data: CreatePlanParams): Promise<AdminPlan> {
  return apiFetchWithInterceptors<AdminPlan>('/admin/plans', {
    method: 'POST',
    body: data,
  })
}

export async function updatePlan(
  id: string,
  data: UpdatePlanParams
): Promise<AdminPlan> {
  return apiFetchWithInterceptors<AdminPlan>(`/admin/plans/${id}`, {
    method: 'PATCH',
    body: data,
  })
}

export async function archivePlan(id: string): Promise<void> {
  await apiFetchWithInterceptors<{ archived: boolean }>(`/admin/plans/${id}`, {
    method: 'DELETE',
  })
}

// ─── Quota Types ───────────────────────────────────────────────────────────────

export type PlanQuota = {
  resourceType: string
  limit: number
  period: string
}

// ─── Quota Service Functions ────────────────────────────────────────────────────

export async function savePlanQuotas(
  planId: string,
  quotas: PlanQuota[]
): Promise<void> {
  await apiFetchWithInterceptors(`/admin/plans/${planId}/quotas`, {
    method: 'PUT',
    body: { quotas },
  })
}

export async function getPlanQuotas(planId: string): Promise<PlanQuota[]> {
  const response = await apiFetchWithInterceptors<{ quotas: PlanQuota[] }>(
    `/admin/plans/${planId}/quotas`,
    { method: 'GET' }
  )
  return response.quotas
}
