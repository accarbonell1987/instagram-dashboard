import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import type { ModuleService } from '../../services/index.js'
import { ForbiddenError } from '../../errors.js'
import { purgeAnalyticsEntitlementsCache } from '../../lib/entitlements-purge.js'
import { TrialParamsSchema, GrantTrialRequestSchema, GrantTrialResponseSchema } from '../schemas/admin.schemas.js'
import { commonErrorResponses } from '../schemas/index.js'

function assertSuperAdmin(role: string): void {
  if (role !== 'SuperAdmin') {
    throw new ForbiddenError('trials.forbidden', 'SuperAdmin role required')
  }
}

// b1 (5.1, owner-confirmed #1677): tenant-level trial grant — creates
// Entitlement(source: trial, kind: grant, expiresAt), then fans out a
// best-effort cache purge (mirrors upsertTenantModuleOverride's fan-out in
// admin-modules.ts).
export function createAdminTrialsRouter(
  moduleService: ModuleService,
  authGuard: MiddlewareHandler,
  idempotency: MiddlewareHandler,
) {
  const router = new OpenAPIHono()

  router.use('/admin/tenants/:tenantId/trials', authGuard)
  router.on('POST', '/admin/tenants/:tenantId/trials', idempotency)

  const grantTrialRoute = createRoute({
    method: 'post',
    path: '/admin/tenants/{tenantId}/trials',
    operationId: 'grantTenantTrial',
    tags: ['admin', 'trials'],
    request: {
      params: TrialParamsSchema,
      body: {
        content: { 'application/json': { schema: GrantTrialRequestSchema } },
      },
    },
    responses: {
      201: {
        content: { 'application/json': { schema: GrantTrialResponseSchema } },
        description: 'Trial granted',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
      422: commonErrorResponses[422],
    },
  })

  router.openapi(grantTrialRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { tenantId } = c.req.valid('param')
    const { productId, moduleId, durationDays } = c.req.valid('json')
    const createdBy = c.var.user.sub
    const trial = await moduleService.grantTrial(tenantId, productId, moduleId, durationDays, createdBy)
    purgeAnalyticsEntitlementsCache(tenantId, productId)

    return c.json(
      {
        tenantId: trial.tenantId,
        productId: trial.productId,
        moduleId: trial.moduleId,
        expiresAt: trial.expiresAt.toISOString(),
      },
      201,
    )
  })

  return router
}
