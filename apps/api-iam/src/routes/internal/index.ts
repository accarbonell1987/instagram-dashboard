import { OpenAPIHono } from '@hono/zod-openapi';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { NotFoundError } from '../../errors.js';

/**
 * Internal service-to-service routes.
 * No auth guard — protected by network isolation.
 * These routes are NOT exposed in the public OpenAPI spec.
 */
export function createInternalRouter(prisma: PrismaClient) {
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

  return router;
}
