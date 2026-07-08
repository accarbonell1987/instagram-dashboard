import type { PlanChangeRepository } from '../repositories/plan-change/index.js'
import type { TenantRepository } from '../repositories/tenant/types.js'
import type { PlanRepository } from '../repositories/plan/types.js'
import type { UserRepository } from '../repositories/user/types.js'
import type { EmailAdapter } from '../adapters/email/types.js'
import type { Config } from '../config.js'
import type { PrismaClient } from '../generated/prisma/client.js'
import type { Logger } from '../lib/logger.js'
import { ForbiddenError, ConflictError } from '../errors.js'

export type PlanChangeServiceDeps = {
  planChangeRepo: PlanChangeRepository
  tenantRepo: TenantRepository
  planRepo: PlanRepository
  userRepo: UserRepository
  emailAdapter: EmailAdapter
  config: Config
  prisma: PrismaClient
  logger: Logger
}

export function createPlanChangeService({
  planChangeRepo,
  tenantRepo,
  planRepo,
  userRepo,
  emailAdapter,
  config,
  prisma,
  logger,
}: PlanChangeServiceDeps) {
  const log = logger.child({ service: 'plan-change' })

  async function createRequest(params: {
    tenantUuid: string
    requesterUserId: string
    requesterRole: string
    toPlanId: string
  }): Promise<{ id: string }> {
    if (params.requesterRole !== 'TenantAdmin' && params.requesterRole !== 'SuperAdmin') {
      throw new ForbiddenError('plan_change.forbidden')
    }

    // findByUuid throws NotFoundError if not found — let it propagate
    const tenant = await tenantRepo.findByUuid(params.tenantUuid)

    // findById throws NotFoundError if not found — let it propagate
    await planRepo.findById(params.toPlanId)

    if (tenant.planId === params.toPlanId) {
      throw new ConflictError('plan_change.same_plan')
    }

    // Fetch requester email for notification
    const requester = await userRepo.findById(params.requesterUserId)

    const planChangeRequest = await prisma.$transaction(async (tx) => {
      const existing = await planChangeRepo.findPendingByTenant(params.tenantUuid)
      if (existing !== null) throw new ConflictError('plan_change.request_pending')
      return planChangeRepo.create(
        {
          tenantId: params.tenantUuid,
          requestedBy: params.requesterUserId,
          fromPlanId: tenant.planId,
          toPlanId: params.toPlanId,
        },
        tx,
      )
    })

    void emailAdapter
      .sendPlanChangeNotification({
        to: config.PLAN_CHANGE_NOTIFY_TO,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        fromPlanId: tenant.planId,
        toPlanId: params.toPlanId,
        requesterEmail: requester.email,
      })
      .then(() => {
        log.info({
          category: 'email',
          event: 'plan_change_email_sent',
          tenantId: params.tenantUuid,
        })
      })
      .catch((err: unknown) => {
        log.error({
          category: 'email',
          event: 'plan_change_email_failed',
          tenantId: params.tenantUuid,
          err,
        })
      })

    return { id: planChangeRequest.id }
  }

  return { createRequest }
}

export type PlanChangeService = ReturnType<typeof createPlanChangeService>
