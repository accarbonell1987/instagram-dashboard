import type { PrismaClient } from '../generated/prisma/client.js'
import type { TenantRepository } from '../repositories/tenant/index.js'
import type { UserRepository } from '../repositories/user/index.js'
import type { RefreshTokenRepository } from '../repositories/refresh-token/index.js'
import type { TenantStatus } from '../domain/index.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type AdminTenantListParams = {
  page: number
  pageSize: number
  search?: string | undefined
  status?: TenantStatus | undefined
}

export type AdminTenantListItem = {
  id: string
  name: string
  slug: string
  status: TenantStatus
  planId: string
  planName: string
  userCount: number
  createdAt: Date
}

export type AdminTenantListResult = {
  items: AdminTenantListItem[]
  total: number
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
  createdAt: Date
  updatedAt: Date
}

export type AdminTenantServiceDeps = {
  tenantRepo: TenantRepository
  userRepo: UserRepository
  refreshTokenRepo: RefreshTokenRepository
  prisma: PrismaClient
}

// ── Service ───────────────────────────────────────────────────────────────────

export function createAdminTenantService(deps: AdminTenantServiceDeps) {
  const { tenantRepo, userRepo, refreshTokenRepo } = deps

  async function listTenants(params: AdminTenantListParams): Promise<AdminTenantListResult> {
    const result = await tenantRepo.findAllPaginated({
      page: params.page,
      pageSize: params.pageSize,
      search: params.search,
      status: params.status,
    })

    return {
      items: result.items.map((item) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        status: item.status,
        planId: item.planId,
        planName: item.planName,
        userCount: item.userCount,
        createdAt: item.createdAt,
      })),
      total: result.total,
    }
  }

  async function getTenantDetail(id: string): Promise<AdminTenantDetail> {
    const detail = await tenantRepo.findByIdWithDetail(id)

    return {
      id: detail.id,
      name: detail.name,
      slug: detail.slug,
      status: detail.status,
      plan: detail.plan,
      userCount: detail.userCount,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
    }
  }

  async function changeTenantStatus(
    id: string,
    status: TenantStatus
  ): Promise<{ id: string; status: TenantStatus }> {
    const updated = await tenantRepo.updateStatus(id, status)

    // Invalidate all user sessions when suspending a tenant
    if (status === 'suspended') {
      const userIds = await userRepo.findActiveUserIdsByTenant(id)
      await Promise.all(
        userIds.map((userId) => refreshTokenRepo.invalidateAllForUser(userId))
      )
    }

    return { id: updated.id, status: updated.status }
  }

  return { listTenants, getTenantDetail, changeTenantStatus }
}

export type AdminTenantService = ReturnType<typeof createAdminTenantService>
