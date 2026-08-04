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
    const userId = c.req.query('userId');

    if (!productId) {
      throw new ValidationError('entitlements.product_id_required', 'productId query parameter is required');
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) {
      throw new NotFoundError('tenant.not_found');
    }

    const effectiveModules = await moduleService.getEffectiveModulesForTenantAndProduct(tenantId, productId, userId ?? undefined);

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

  // a4 purge-direction correction (owner-resolved): the entitlement cache
  // lives in the guard (packages/entitlements, mounted by the product API),
  // so the purge route lives there too — api-iam is the CALLER
  // (see lib/entitlements-purge.ts), not the host. The reserved placeholder
  // added in a3 was wrong-directional and has been removed.

  return router;
}
