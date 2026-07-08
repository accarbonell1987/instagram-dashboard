import type { Tenant, TenantStatus } from '../../domain/index.js'

export interface CreateTenantInput {
  slug: string
  name: string
  planId: string
  status: TenantStatus
}

export interface TenantListQuery {
  page: number
  pageSize: number
  search?: string | undefined
  status?: TenantStatus | undefined
}

export interface TenantListItem {
  id: string
  name: string
  slug: string
  status: TenantStatus
  planId: string
  planName: string
  userCount: number
  createdAt: Date
}

export interface TenantListResult {
  items: TenantListItem[]
  total: number
}

export interface TenantDetail {
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
  createdAt: Date
  updatedAt: Date
}

export interface TenantRepository {
  findBySlug(slug: string): Promise<Tenant | null>
  findByUuid(id: string): Promise<Tenant>
  create(data: CreateTenantInput): Promise<Tenant>
  updateStatus(id: string, status: TenantStatus): Promise<Tenant>
  updateName(id: string, name: string): Promise<void>
  findAllPaginated(query: TenantListQuery): Promise<TenantListResult>
  findByIdWithDetail(id: string): Promise<TenantDetail>
}
