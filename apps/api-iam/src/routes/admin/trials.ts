import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import type { ModuleService } from '../../services/index.js'
import { ForbiddenError, NotFoundError } from '../../errors.js'
import { purgeAnalyticsEntitlementsCache } from '../../lib/entitlements-purge.js'
import type { PrismaClient } from '../../generated/prisma/client.js'
import { TrialParamsSchema, GrantTrialRequestSchema, GrantTrialResponseSchema } from '../schemas/admin.schemas.js'
import { commonErrorResponses } from '../schemas/index.js'

function assertSuperAdmin(role: string): void {
  if (role !== 'SuperAdmin') {
    throw new ForbiddenError('trials.forbidden', 'SuperAdmin role required')
  }
}

// b1 (5.1, owner-confirmed #1677) + b1.5 (PR7, owner decision #1679/1):
// tenant-level trial grant — creates Entitlement(source: trial, kind:
// grant, expiresAt), then fans out a best-effort cache purge (mirrors
// upsertTenantModuleOverride's fan-out in admin-modules.ts). Omitted
// moduleId means a product-scoped grant (all modules of the product).
export function createAdminTrialsRouter(
  moduleService: ModuleService,
  prisma: PrismaClient,
  authGuard: MiddlewareHandler,
  idempotency: MiddlewareHandler,
) {
  const router = new OpenAPIHono()

  router.use('/admin/tenants/:tenantId/trials', authGuard)
  router.use('/admin/trials', authGuard)
  router.use('/admin/trials/:entitlementId', authGuard)
  router.on('POST', '/admin/tenants/:tenantId/trials', idempotency)
  router.on('POST', '/admin/trials/:entitlementId/reset', idempotency)
  router.on('POST', '/admin/trials/:entitlementId/extend', idempotency)

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
    const trial = await moduleService.grantTrial(tenantId, productId, moduleId ?? null, durationDays, createdBy)
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

  // GET /admin/trials?productId=X — list active trials
  router.openapi(
    createRoute({
      method: 'get', path: '/admin/trials', operationId: 'listTrials',
      tags: ['admin', 'trials'],
      responses: { 200: { description: 'Active trials' }, 401: commonErrorResponses[401], 403: commonErrorResponses[403] },
    }),
    async (c) => {
      assertSuperAdmin(c.var.user.role)
      const productId = c.req.query('productId') ?? undefined;
      const now = new Date();
      const trials = await prisma.entitlement.findMany({
        where: {
          source: 'trial',
          ...(productId ? { productId } : {}),
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        include: { module: true },
        orderBy: { createdAt: 'desc' },
      });
      const result = trials.map((t) => ({
        id: t.id,
        tenantId: t.tenantId,
        productId: t.productId,
        moduleId: t.moduleId,
        moduleName: t.module?.name ?? null,
        createdAt: t.createdAt.toISOString(),
        expiresAt: t.expiresAt?.toISOString() ?? null,
        remainingDays: t.expiresAt
          ? Math.max(0, Math.ceil((t.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          : null,
        consumedDays: t.expiresAt
          ? Math.max(0, Math.ceil((now.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60 * 24)))
          : null,
      }));
      return c.json({ trials: result }, 200);
    },
  );

  // POST /admin/trials/:entitlementId/reset — reset trial to start now
  router.openapi(
    createRoute({
      method: 'post', path: '/admin/trials/{entitlementId}/reset', operationId: 'resetTrial',
      tags: ['admin', 'trials'],
      request: { params: z.object({ entitlementId: z.string() }) },
      responses: { 200: { description: 'Trial reset' }, 404: commonErrorResponses[404] },
    }),
    async (c) => {
      assertSuperAdmin(c.var.user.role)
      const { entitlementId } = c.req.valid('param')
      const trial = await prisma.entitlement.findUnique({ where: { id: entitlementId } })
      if (!trial) throw new NotFoundError('trial.not_found')
      const product = await prisma.product.findUnique({ where: { id: trial.productId } })
      const days = product?.trialDurationDays ?? 14
      const expiresAt = new Date()
      expiresAt.setUTCDate(expiresAt.getUTCDate() + days)
      await prisma.entitlement.update({
        where: { id: entitlementId },
        data: { expiresAt, createdAt: new Date() },
      })
      return c.json({ expiresAt: expiresAt.toISOString(), remainingDays: days }, 200)
    },
  );

  // POST /admin/trials/:entitlementId/extend — add days to trial
  router.openapi(
    createRoute({
      method: 'post', path: '/admin/trials/{entitlementId}/extend', operationId: 'extendTrial',
      tags: ['admin', 'trials'],
      request: {
        params: z.object({ entitlementId: z.string() }),
        body: { content: { 'application/json': { schema: z.object({ days: z.number().int().min(1).max(365) }) } } },
      },
      responses: { 200: { description: 'Trial extended' }, 404: commonErrorResponses[404] },
    }),
    async (c) => {
      assertSuperAdmin(c.var.user.role)
      const { entitlementId } = c.req.valid('param')
      const body = await c.req.json() as { days: number }
      const days = body.days
      if (!days || days < 1 || days > 365) {
        return c.json({ error: 'days must be 1-365' }, 422)
      }
      const trial = await prisma.entitlement.findUnique({ where: { id: entitlementId } })
      if (!trial) throw new NotFoundError('trial.not_found')
      const newExpiresAt = new Date(trial.expiresAt ?? new Date())
      newExpiresAt.setUTCDate(newExpiresAt.getUTCDate() + days)
      await prisma.entitlement.update({
        where: { id: entitlementId },
        data: { expiresAt: newExpiresAt },
      })
      const remaining = Math.max(0, Math.ceil((newExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      return c.json({ expiresAt: newExpiresAt.toISOString(), remainingDays: remaining }, 200)
    },
  );

  return router
}
