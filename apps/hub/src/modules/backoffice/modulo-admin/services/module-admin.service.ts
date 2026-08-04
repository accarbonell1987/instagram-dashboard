import { apiFetchWithInterceptors } from '@/lib/api/interceptors'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface AdminModule {
  id: string
  name: string
  description?: string
  defaultUrl: string
  active: boolean
  productId: string | null
  parentId: string | null
}

export interface ListModulesResponse {
  modules: AdminModule[]
}

export interface CreateModuleParams {
  id: string
  name: string
  description?: string | undefined
  defaultUrl: string
  // Required by the API: a module always belongs to exactly one product and
  // can only be attached to plans of that same product.
  productId: string
  parentId?: string | undefined
}

export interface UpdateModuleParams {
  name?: string | undefined
  description?: string | undefined
  defaultUrl?: string | undefined
  active?: boolean | undefined
}

// ─── Service functions ──────────────────────────────────────────────────────────

export async function listModules(productId?: string): Promise<ListModulesResponse> {
  const qs = productId !== undefined ? `?productId=${encodeURIComponent(productId)}` : '';
  return apiFetchWithInterceptors<ListModulesResponse>(`/admin/modules${qs}`, {
    method: 'GET',
  })
}

export async function getModule(id: string): Promise<AdminModule> {
  return apiFetchWithInterceptors<AdminModule>(`/admin/modules/${id}`, {
    method: 'GET',
  })
}

export async function createModule(data: CreateModuleParams): Promise<AdminModule> {
  return apiFetchWithInterceptors<AdminModule>('/admin/modules', {
    method: 'POST',
    body: data,
  })
}

export async function updateModule(
  id: string,
  data: UpdateModuleParams
): Promise<AdminModule> {
  return apiFetchWithInterceptors<AdminModule>(`/admin/modules/${id}`, {
    method: 'PATCH',
    body: data,
  })
}

export async function deleteModule(id: string): Promise<void> {
  await apiFetchWithInterceptors<{ success: true }>(`/admin/modules/${id}`, {
    method: 'DELETE',
  })
}

export async function getPlanModules(
  planId: string
): Promise<{ moduleIds: string[] }> {
  return apiFetchWithInterceptors<{ moduleIds: string[] }>(
    `/admin/plans/${planId}/modules`,
    { method: 'GET' }
  )
}

export async function setPlanModules(
  planId: string,
  moduleIds: string[]
): Promise<void> {
  await apiFetchWithInterceptors<{ success: true }>(`/admin/plans/${planId}/modules`, {
    method: 'PUT',
    body: { moduleIds },
  })
}

export async function upsertTenantModuleOverride(
  tenantId: string,
  moduleId: string,
  enabled: boolean,
  reason?: string
): Promise<void> {
  await apiFetchWithInterceptors<{ success: true }>(
    `/admin/tenants/${tenantId}/modules/${moduleId}/override`,
    {
      method: 'PUT',
      body: { enabled, reason },
    }
  )
}

export async function removeTenantModuleOverride(
  tenantId: string,
  moduleId: string
): Promise<void> {
  await apiFetchWithInterceptors<{ success: true }>(
    `/admin/tenants/${tenantId}/modules/${moduleId}/override`,
    { method: 'DELETE' }
  )
}
