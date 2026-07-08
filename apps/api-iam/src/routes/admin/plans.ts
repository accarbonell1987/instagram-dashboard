import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import type { PlanService } from '../../services/index.js'
import type { PlanQuotaRepository } from '../../repositories/index.js'
import { ForbiddenError, ConflictError } from '../../errors.js'
import {
  AdminPlanSchema,
  AdminPlanListResponseSchema,
  AdminCreatePlanSchema,
  AdminUpdatePlanSchema,
  AdminPlanParamsSchema,
  PlanQuotaItemSchema,
  PlanQuotaListResponseSchema,
  UpsertPlanQuotasRequestSchema,
} from '../schemas/admin.schemas.js'
import { commonErrorResponses } from '../schemas/index.js'

function assertSuperAdmin(role: string): void {
  if (role !== 'SuperAdmin') {
    throw new ForbiddenError('plans.forbidden', 'SuperAdmin role required')
  }
}

export function createAdminPlansRouter(
  planService: PlanService,
  planQuotaRepo: PlanQuotaRepository,
  authGuard: MiddlewareHandler,
  idempotency: MiddlewareHandler,
) {
  const router = new OpenAPIHono()

  // Apply authGuard to all admin routes
  router.use('/admin/plans', authGuard)
  router.use('/admin/plans/:planId', authGuard)
  router.use('/admin/plans/:planId/quotas', authGuard)

  // ── GET /admin/plans ─────────────────────────────────────────────────────

  const listAdminPlansRoute = createRoute({
    method: 'get',
    path: '/admin/plans',
    operationId: 'listAdminPlans',
    tags: ['admin', 'plans'],
    request: {
      query: z.object({
        active: z.enum(['true', 'false']).optional(),
      }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: AdminPlanListResponseSchema } },
        description: 'List of admin plans',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
    },
  })

  router.openapi(listAdminPlansRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const rawActive = c.req.query('active')

    const filter: { active?: boolean } = {}
    if (rawActive === 'true') filter.active = true
    else if (rawActive === 'false') filter.active = false

    const plans = await planService.listPlans(filter)

    return c.json(
      {
        plans: plans.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          currency: p.currency,
          billingInterval: p.billingInterval,
          active: p.active,
          tenantCount: p.tenantCount,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        })),
      },
      200,
    )
  })

  // ── POST /admin/plans ────────────────────────────────────────────────────

  router.on('POST', '/admin/plans', idempotency)

  const createPlanRoute = createRoute({
    method: 'post',
    path: '/admin/plans',
    operationId: 'createPlan',
    tags: ['admin', 'plans'],
    request: {
      body: {
        content: { 'application/json': { schema: AdminCreatePlanSchema } },
      },
    },
    responses: {
      201: {
        content: { 'application/json': { schema: AdminPlanSchema } },
        description: 'Plan created',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      409: commonErrorResponses[409],
      422: commonErrorResponses[422],
    },
  })

  router.openapi(createPlanRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const body = c.req.valid('json')
    const description: string | undefined = body.description
    const plan = await planService.createPlan({
      name: body.name,
      ...(description !== undefined ? { description } : {}),
      price: body.price,
      currency: body.currency,
      billingInterval: body.billingInterval,
    })

    return c.json(
      {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        currency: plan.currency,
        billingInterval: plan.billingInterval,
        active: plan.active,
        tenantCount: 0,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
      },
      201,
    )
  })

  // ── PATCH /admin/plans/:planId ───────────────────────────────────────────

  router.on('PATCH', '/admin/plans/:planId', idempotency)

  const updatePlanRoute = createRoute({
    method: 'patch',
    path: '/admin/plans/{planId}',
    operationId: 'updatePlan',
    tags: ['admin', 'plans'],
    request: {
      params: AdminPlanParamsSchema,
      body: {
        content: { 'application/json': { schema: AdminUpdatePlanSchema } },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: AdminPlanSchema } },
        description: 'Plan updated',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
      422: commonErrorResponses[422],
    },
  })

  router.openapi(updatePlanRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { planId } = c.req.valid('param')
    const body = c.req.valid('json')

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData['name'] = body.name
    if (body.description !== undefined) updateData['description'] = body.description
    if (body.price !== undefined) updateData['price'] = body.price
    if (body.currency !== undefined) updateData['currency'] = body.currency
    if (body.billingInterval !== undefined) updateData['billingInterval'] = body.billingInterval
    if (body.active !== undefined) updateData['active'] = body.active

    const plan = await planService.updatePlan(planId, updateData as any)

    return c.json(
      {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        currency: plan.currency,
        billingInterval: plan.billingInterval,
        active: plan.active,
        tenantCount: 0,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
      },
      200,
    )
  })

  // ── DELETE /admin/plans/:planId (archive) ────────────────────────────────

  router.on('DELETE', '/admin/plans/:planId', idempotency)

  const archivePlanRoute = createRoute({
    method: 'delete',
    path: '/admin/plans/{planId}',
    operationId: 'archivePlan',
    tags: ['admin', 'plans'],
    request: {
      params: AdminPlanParamsSchema,
    },
    responses: {
      200: {
        content: { 'application/json': { schema: AdminPlanSchema } },
        description: 'Plan archived',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
      409: commonErrorResponses[409],
    },
  })

  router.openapi(archivePlanRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { planId } = c.req.valid('param')
    const plan = await planService.archivePlan(planId)

    return c.json(
      {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        currency: plan.currency,
        billingInterval: plan.billingInterval,
        active: plan.active,
        tenantCount: 0,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
      },
      200,
    )
  })

  // ── GET /admin/plans/:planId/quotas ───────────────────────────────────────

  const listPlanQuotasRoute = createRoute({
    method: 'get',
    path: '/admin/plans/{planId}/quotas',
    operationId: 'listPlanQuotas',
    tags: ['admin', 'plans'],
    request: {
      params: AdminPlanParamsSchema,
    },
    responses: {
      200: {
        content: { 'application/json': { schema: PlanQuotaListResponseSchema } },
        description: 'List of quotas for a plan',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
    },
  })

  router.openapi(listPlanQuotasRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { planId } = c.req.valid('param')
    // Verify plan exists
    await planService.getPlan(planId)
    const quotas = await planQuotaRepo.findByPlanId(planId)

    return c.json(
      {
        quotas: quotas.map((q) => ({
          id: q.id,
          planId: q.planId,
          resourceType: q.resourceType,
          limit: q.limit,
          period: q.period,
          createdAt: q.createdAt.toISOString(),
          updatedAt: q.updatedAt.toISOString(),
        })),
      },
      200,
    )
  })

  // ── PUT /admin/plans/:planId/quotas ────────────────────────────────────────

  router.on('PUT', '/admin/plans/:planId/quotas', idempotency)

  const upsertPlanQuotasRoute = createRoute({
    method: 'put',
    path: '/admin/plans/{planId}/quotas',
    operationId: 'upsertPlanQuotas',
    tags: ['admin', 'plans'],
    request: {
      params: AdminPlanParamsSchema,
      body: {
        content: { 'application/json': { schema: UpsertPlanQuotasRequestSchema } },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: PlanQuotaListResponseSchema } },
        description: 'Quotas upserted successfully',
      },
      400: commonErrorResponses[400],
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
      409: commonErrorResponses[409],
      422: commonErrorResponses[422],
    },
  })

  router.openapi(upsertPlanQuotasRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { planId } = c.req.valid('param')
    const body = c.req.valid('json')

    // Verify plan exists
    await planService.getPlan(planId)

    // Upsert each quota in the request
    const results = []
    for (const item of body.quotas) {
      const quota = await planQuotaRepo.upsert(
        planId,
        item.resourceType,
        item.limit,
        item.period,
      )
      results.push(quota)
    }

    // Fire-and-forget cache bust to analytics
    const analyticsUrl = process.env.ANALYTICS_INTERNAL_URL ?? 'http://localhost:3003'
    fetch(`${analyticsUrl}/internal/quotas/purge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId }),
    }).catch(() => {
      // Fire-and-forget — failure is non-critical
    })

    return c.json(
      {
        quotas: results.map((q) => ({
          id: q.id,
          planId: q.planId,
          resourceType: q.resourceType,
          limit: q.limit,
          period: q.period,
          createdAt: q.createdAt.toISOString(),
          updatedAt: q.updatedAt.toISOString(),
        })),
      },
      200,
    )
  })

  return router
}
