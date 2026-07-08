import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { PlanService } from '../../services/index.js';
import type { PlanQuotaRepository } from '../../repositories/index.js';
import { ListPlansResponseSchema, GetPlanResponseSchema } from '../schemas/index.js';
import { commonErrorResponses } from '../schemas/index.js';
import { PlanQuotaListResponseSchema } from '../schemas/admin.schemas.js';

export function createPlansRouter(planService: PlanService, planQuotaRepo: PlanQuotaRepository) {
  const router = new OpenAPIHono();

  const listPlansRoute = createRoute({
    method: 'get',
    path: '/plans',
    operationId: 'listPlans',
    tags: ['plans'],
    security: [],
    responses: {
      200: {
        content: { 'application/json': { schema: ListPlansResponseSchema } },
        description: 'Plans list',
      },
    },
  });

  router.openapi(listPlansRoute, async (c) => {
    const plans = await planService.listPlans();
    return c.json(
      {
        plans: plans.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          currency: p.currency,
          billingCycle: p.billingInterval as 'monthly' | 'yearly',
          features: Array.isArray(p.features)
            ? (p.features as string[])
            : Object.keys(p.features as Record<string, unknown>),
          popular: p.popular ?? false,
        })),
      },
      200
    );
  });

  const getPlanRoute = createRoute({
    method: 'get',
    path: '/plans/{planId}',
    operationId: 'getPlan',
    tags: ['plans'],
    security: [],
    request: {
      params: z.object({ planId: z.string() }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: GetPlanResponseSchema } },
        description: 'Plan detail',
      },
      404: commonErrorResponses[404],
    },
  });

  router.openapi(getPlanRoute, async (c) => {
    const { planId } = c.req.valid('param');
    const plan = await planService.getPlan(planId);
    return c.json(
      {
        id: plan.id,
        name: plan.name,
        price: plan.price,
        currency: plan.currency,
        billingCycle: plan.billingInterval as 'monthly' | 'yearly',
        features: Array.isArray(plan.features)
          ? (plan.features as string[])
          : Object.keys(plan.features as Record<string, unknown>),
        popular: plan.popular ?? false,
      },
      200
    );
  });

  // ── GET /plans/:planId/quotas ──────────────────────────────────────────────

  const getPlanQuotasRoute = createRoute({
    method: 'get',
    path: '/plans/{planId}/quotas',
    operationId: 'getPlanQuotas',
    tags: ['plans'],
    security: [],
    request: {
      params: z.object({ planId: z.string() }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: PlanQuotaListResponseSchema } },
        description: 'Quotas for a plan',
      },
      404: commonErrorResponses[404],
    },
  });

  router.openapi(getPlanQuotasRoute, async (c) => {
    const { planId } = c.req.valid('param');
    // Verify plan exists
    await planService.getPlan(planId);
    const quotas = await planQuotaRepo.findByPlanId(planId);

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
      200
    );
  });

  return router;
}
