import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";

import { createApiRouter } from "../../lib/create-openapi-router.js";

const HealthResponseSchema = z
  .object({
    status: z.string().openapi({ example: "ok" }),
    timestamp: z
      .string()
      .datetime()
      .openapi({ example: "2026-01-01T00:00:00.000Z" }),
  })
  .openapi("HealthResponse");

const health = createRoute({
  method: "get",
  path: "/",
  tags: ["Health"],
  summary: "Health check",
  description: "Returns the current health status of the service.",
  responses: {
    200: {
      content: { "application/json": { schema: HealthResponseSchema } },
      description: "Service is healthy",
    },
  },
});

const ready = createRoute({
  method: "get",
  path: "/ready",
  tags: ["Health"],
  summary: "Readiness check",
  description: "Returns whether the service is ready to accept requests.",
  responses: {
    200: {
      content: { "application/json": { schema: HealthResponseSchema } },
      description: "Service is ready",
    },
  },
});

export function createHealthRoutes(): OpenAPIHono {
  const routes = createApiRouter();

  routes.openapi(health, (c) => {
    return c.json({ status: "ok", timestamp: new Date().toISOString() }, 200);
  });

  routes.openapi(ready, (c) => {
    return c.json(
      { status: "ready", timestamp: new Date().toISOString() },
      200,
    );
  });

  return routes;
}
