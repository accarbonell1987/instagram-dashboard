import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { PlanService } from '../../services/index.js';
import type { PlanQuotaRepository } from '../../repositories/index.js';
import type { Plan, PlanModuleSummary } from '../../domain/index.js';
import { ListPlansResponseSchema, GetPlanResponseSchema } from '../schemas/index.js';
import { commonErrorResponses } from '../schemas/index.js';
import { PlanQuotaListResponseSchema } from '../schemas/admin.schemas.js';

/**
 * Nests the plan's flat module list into module → sub-modules. A sub-module
 * whose parent is not part of the plan is surfaced as a top-level entry, so
 * nothing the plan grants can go missing from the listing.
 */
function toModuleTree(modules: PlanModuleSummary[]) {
  const included = new Set(modules.map((m) => m.id));
  const isRoot = (m: PlanModuleSummary) => m.parentId === null || !included.has(m.parentId);

  return modules.filter(isRoot).map((parent) => ({
    id: parent.id,
    name: parent.name,
    description: parent.description,
    subModules: modules
      .filter((m) => m.parentId === parent.id)
      .map((child) => ({ id: child.id, name: child.name, description: child.description })),
  }));
}

function toPlanResponse(plan: Plan) {
  return {
    id: plan.id,
    name: plan.name,
    price: plan.price,
    currency: plan.currency,
    billingCycle: plan.billingInterval as 'monthly' | 'yearly',
    features: Array.isArray(plan.features)
      ? (plan.features as string[])
      : Object.keys(plan.features as Record<string, unknown>),
    modules: toModuleTree(plan.modules),
    isDefault: plan.isDefault,
    popular: plan.popular ?? false,
  };
}

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
    const productId = c.req.query('productId') ?? undefined;
    const plans = await planService.listPlans(
      productId !== undefined ? { productId, active: true } : undefined,
    );
    return c.json({ plans: plans.map(toPlanResponse) }, 200);
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
    return c.json(toPlanResponse(plan), 200);
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
