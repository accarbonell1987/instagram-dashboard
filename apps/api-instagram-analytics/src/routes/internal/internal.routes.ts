import { OpenAPIHono } from '@hono/zod-openapi';

/**
 * Internal routes — not exposed to the public internet.
 * Protected by network/firewall; no auth middleware.
 *
 * T-10: POST /internal/quotas/purge — cache-bust endpoint called by api-iam
 * when admin updates plan quotas.
 */
export function createInternalRoutes(usageTracker: {
  purgeCache: (planId?: string) => Promise<void>;
}): OpenAPIHono {
  const internal = new OpenAPIHono();

  internal.post('/quotas/purge', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const planId =
      typeof body === 'object' && body && 'planId' in body
        ? (body as { planId?: string }).planId
        : undefined;
    await usageTracker.purgeCache(planId);
    return c.json({ success: true, data: { purged: true } }, 200);
  });

  return internal;
}
