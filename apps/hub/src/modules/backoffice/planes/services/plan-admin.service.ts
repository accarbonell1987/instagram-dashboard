import { apiFetchWithInterceptors } from '@/lib/api/interceptors'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface AdminPlan {
  id: string
  name: string
  description?: string
  price: number
  currency: string
  billingInterval: string
  active: boolean
  productId: string | null
  /** Drag-and-drop rank in the backoffice list; also the order in the wizard. */
  displayOrder: number
  /** The product's default plan — pre-selected in onboarding. One per product. */
  isDefault: boolean
  tenantCount: number
  createdAt: string
  updatedAt: string
}

export interface AdminPlanListResponse {
  plans: AdminPlan[]
}

export interface CreatePlanParams {
  name: string
  description?: string | undefined
  price: number
  currency: string
  billingInterval: string
  productId: string
}

export interface UpdatePlanParams {
  name?: string | undefined
  description?: string | undefined
  price?: number | undefined
  currency?: string | undefined
  billingInterval?: string | undefined
  active?: boolean | undefined
  /** Promoting a plan demotes the others of the same product. */
  isDefault?: boolean | undefined
}

// ─── Service functions ──────────────────────────────────────────────────────────

export async function listPlans(filter?: {
  active?: boolean
  productId?: string
}): Promise<AdminPlanListResponse> {
  const query = new URLSearchParams()
  if (filter?.active !== undefined) {
    query.set('active', String(filter.active))
  }
  if (filter?.productId !== undefined) {
    query.set('productId', filter.productId)
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

export interface PlanQuota {
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

// ─── Ordering ───────────────────────────────────────────────────────────────────

/** Persists the drag-and-drop order: index in the list becomes displayOrder. */
export async function reorderPlans(planIds: string[]): Promise<void> {
  await apiFetchWithInterceptors('/admin/plans/reorder', {
    method: 'PUT',
    body: { planIds },
  })
}
