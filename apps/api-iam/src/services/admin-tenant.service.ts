import { nanoid } from 'nanoid'
import type { PrismaClient } from '../generated/prisma/client.js'
import type { TenantRepository } from '../repositories/tenant/index.js'
import type { UserRepository } from '../repositories/user/index.js'
import type { RefreshTokenRepository } from '../repositories/refresh-token/index.js'
import type { PaymentRepository, OnboardingDraftRepository } from '../repositories/index.js'
import { UNSETTLED_STATUSES, type SettlementService } from './settlement.service.js'
import type { TenantStatus } from '../domain/index.js'
import { ValidationError } from '../errors.js'

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
  paymentRepo: PaymentRepository
  draftRepo: OnboardingDraftRepository
  settlementService: SettlementService
  prisma: PrismaClient
}

// ── Service ───────────────────────────────────────────────────────────────────

export function createAdminTenantService(deps: AdminTenantServiceDeps) {
  const { tenantRepo, userRepo, refreshTokenRepo, paymentRepo, draftRepo, settlementService } = deps

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
    status: TenantStatus,
    actorId?: string,
    note?: string,
  ): Promise<{ id: string; status: TenantStatus }> {
    // Suspend/pending stay a direct write — only activation is a settlement
    // decision (spec "tenant-administration: Manual status changes route
    // through settlement").
    if (status !== 'active') {
      const updated = await tenantRepo.updateStatus(id, status)

      if (status === 'suspended') {
        const userIds = await userRepo.findActiveUserIdsByTenant(id)
        await Promise.all(
          userIds.map((userId) => refreshTokenRepo.invalidateAllForUser(userId))
        )
      }

      return { id: updated.id, status: updated.status }
    }

    if (!note?.trim()) {
      throw new ValidationError('payment.note_required', 'note is required to activate a tenant')
    }

    const payments = await paymentRepo.listByTenant(id)
    const unsettled = payments.find((p) => UNSETTLED_STATUSES.includes(p.status))

    const paymentId = unsettled ? unsettled.id : await createCourtesyPayment(id)

    await settlementService.settlePayment({
      paymentId,
      decision: 'approved',
      settlementKind: 'manual_admin',
      settledBy: actorId,
      note,
    })

    return { id, status: 'active' }
  }

  // Courtesy activation with zero Payment records (e.g. a manually
  // provisioned tenant, see .atl/manual-tenant.md): fabricates a minimal
  // completed draft + pending payment so settlePayment has a real row to
  // settle through the same single path (spec "Courtesy activation with no
  // payment").
  async function createCourtesyPayment(tenantId: string): Promise<string> {
    const tenant = await tenantRepo.findByUuid(tenantId)
    const draft = await draftRepo.create({ planId: tenant.planId, expiresAt: new Date(Date.now() + 86_400_000) })
    await draftRepo.update(draft.id, { status: 'completed', tenantId })
    const payment = await paymentRepo.create({
      draftId: draft.id,
      externalRef: `MANUAL-${nanoid()}`,
      amount: 0,
      currency: 'PYG',
      status: 'pending',
      tenantId,
    })
    return payment.id
  }

  return { listTenants, getTenantDetail, changeTenantStatus }
}

export type AdminTenantService = ReturnType<typeof createAdminTenantService>
