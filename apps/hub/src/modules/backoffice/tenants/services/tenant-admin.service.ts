import { apiFetchWithInterceptors } from '@/lib/api/interceptors'

// ─── Types ──────────────────────────────────────────────────────────────────────

export type TenantStatus = 'pending' | 'active' | 'suspended'

export type AdminTenantListItem = {
  id: string
  name: string
  slug: string
  status: TenantStatus
  planId: string
  planName: string
  userCount: number
  createdAt: string
}

export type AdminTenantListResponse = {
  items: AdminTenantListItem[]
  total: number
  page: number
  pageSize: number
}

export type AdminTenantDetail = {
  id: string
  name: string
  slug: string
  status: TenantStatus
  plan: {
    id: string
    name: string
    price: number
    currency: string
    billingInterval: string
  }
  userCount: number
  createdAt: string
  updatedAt: string
}

export type ListTenantsParams = {
  page?: number | undefined
  pageSize?: number | undefined
  search?: string | undefined
  status?: TenantStatus | undefined
}

// ─── Service functions ──────────────────────────────────────────────────────────

export async function listTenants(
  params?: ListTenantsParams
): Promise<AdminTenantListResponse> {
  const query = new URLSearchParams()
  if (params?.page !== undefined) query.set('page', String(params.page))
  if (params?.pageSize !== undefined) query.set('pageSize', String(params.pageSize))
  if (params?.search !== undefined) query.set('search', params.search)
  if (params?.status !== undefined) query.set('status', params.status)
  const qs = query.size > 0 ? `?${query.toString()}` : ''

  return apiFetchWithInterceptors<AdminTenantListResponse>(`/admin/tenants${qs}`, {
    method: 'GET',
  })
}

export async function getTenant(id: string): Promise<AdminTenantDetail> {
  return apiFetchWithInterceptors<AdminTenantDetail>(`/admin/tenants/${id}`, {
    method: 'GET',
  })
}

export async function changeTenantStatus(
  id: string,
  status: TenantStatus
): Promise<{ id: string; status: string }> {
  return apiFetchWithInterceptors<{ id: string; status: string }>(
    `/admin/tenants/${id}/status`,
    {
      method: 'PATCH',
      body: { status },
    }
  )
}
