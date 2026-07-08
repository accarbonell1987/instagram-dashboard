import { createRoute, z } from '@hono/zod-openapi';
import type { OpenAPIHono } from '@hono/zod-openapi';

import { createApiRouter } from '../../lib/create-openapi-router.js';

const HealthResponseSchema = z
  .object({
    status: z.string().openapi({ example: 'ok' }),
    timestamp: z
      .string()
      .datetime()
      .openapi({ example: '2026-01-01T00:00:00.000Z' }),
  })
  .openapi('HealthResponse');

const health = createRoute({
  method: 'get',
  path: '/',
  tags: ['Health'],
  summary: 'Health check',
  description: 'Returns the current health status of the service.',
  responses: {
    200: {
      content: { 'application/json': { schema: HealthResponseSchema } },
      description: 'Service is healthy',
    },
  },
});

const ready = createRoute({
  method: 'get',
  path: '/ready',
  tags: ['Health'],
  summary: 'Readiness check',
  description:
    'Returns whether the service is ready to accept requests. Checks database connectivity when available.',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            status: z.literal('ok'),
            database: z.literal('connected'),
          }),
        },
      },
      description: 'Service is ready',
    },
    503: {
      content: {
        'application/json': {
          schema: z.object({
            status: z.literal('degraded'),
            database: z.literal('disconnected'),
          }),
        },
      },
      description: 'Service is not ready',
    },
  },
});

export function createHealthRoutes(prisma?: {
  $queryRaw: (...args: unknown[]) => Promise<unknown>;
}): OpenAPIHono {
  const routes = createApiRouter();

  routes.openapi(health, (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() }, 200);
  });

  if (prisma) {
    routes.openapi(ready, async (c) => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return c.json(
          { status: 'ok' as const, database: 'connected' as const },
          200,
        );
      } catch {
        return c.json(
          { status: 'degraded' as const, database: 'disconnected' as const },
          503,
        );
      }
    });
  }

  return routes;
}
