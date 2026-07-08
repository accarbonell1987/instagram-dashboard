import { apiFetchWithInterceptors } from '@/lib/api/interceptors'

// ─── Types ──────────────────────────────────────────────────────────────────────

export type AdminModule = {
  id: string
  name: string
  description?: string
  defaultUrl: string
  active: boolean
}

export type ListModulesResponse = {
  modules: AdminModule[]
}

export type CreateModuleParams = {
  id: string
  name: string
  description?: string | undefined
  defaultUrl: string
}

export type UpdateModuleParams = {
  name?: string | undefined
  description?: string | undefined
  defaultUrl?: string | undefined
  active?: boolean | undefined
}

// ─── Service functions ──────────────────────────────────────────────────────────

export async function listModules(): Promise<ListModulesResponse> {
  return apiFetchWithInterceptors<ListModulesResponse>('/admin/modules', {
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
