import { OpenAPIHono } from '@hono/zod-openapi';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { NotFoundError, ValidationError } from '../../errors.js';
import type { ModuleService } from '../../services/index.js';

/**
 * Internal service-to-service routes.
 * No auth guard — protected by network isolation.
 * These routes are NOT exposed in the public OpenAPI spec.
 */
export function createInternalRouter(prisma: PrismaClient, moduleService: ModuleService) {
  const router = new OpenAPIHono();

  // GET /internal/tenants/:tenantId → { planId: string }
  router.get('/internal/tenants/:tenantId', async (c) => {
    const tenantId = c.req.param('tenantId');
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { planId: true },
    });

    if (!tenant) {
      throw new NotFoundError('tenant.not_found');
    }

    return c.json({ planId: tenant.planId }, 200);
  });

  // a3 (3.2): GET /internal/tenants/:tenantId/entitlements?productId=&moduleId=
  // Called by the future entitlement middleware (packages/entitlements, a4)
  // to resolve access for one (tenant, product[, module]).
  router.get('/internal/tenants/:tenantId/entitlements', async (c) => {
    const tenantId = c.req.param('tenantId');
    const productId = c.req.query('productId');
    const moduleId = c.req.query('moduleId');

    if (!productId) {
      throw new ValidationError('entitlements.product_id_required', 'productId query parameter is required');
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) {
      throw new NotFoundError('tenant.not_found');
    }

    const effectiveModules = await moduleService.getEffectiveModulesForTenantAndProduct(tenantId, productId);

    if (moduleId) {
      const match = effectiveModules.find((module) => module.id === moduleId);
      return c.json({ allowed: Boolean(match), source: match?.source ?? null }, 200);
    }

    return c.json(
      {
        allowed: effectiveModules.length > 0,
        modules: effectiveModules.map((module) => ({ id: module.id, source: module.source })),
      },
      200,
    );
  });

  // a3 (3.3): POST /internal/entitlements/purge — cache-purge hook mirroring
  // the /internal/quotas/purge style already used between api-iam and
  // product APIs (see routes/admin/plans.ts). api-iam resolves entitlements
  // live and has no cache of its own; this reserves the contract so admin
  // write paths and future callers can trigger downstream cache
  // invalidation once packages/entitlements (a4) mounts a product-API cache.
  router.post('/internal/entitlements/purge', async (c) => {
    const body = await c.req.json().catch(() => ({}) as Record<string, unknown>);
    return c.json(
      {
        success: true,
        data: {
          purged: true,
          tenantId: (body['tenantId'] as string | undefined) ?? null,
          productId: (body['productId'] as string | undefined) ?? null,
        },
      },
      200,
    );
  });

  return router;
}
