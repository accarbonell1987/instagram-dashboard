import type { MiddlewareHandler } from "hono";

export const requestId: MiddlewareHandler = async (c, next) => {
  const id = c.req.header("X-Request-ID") ?? crypto.randomUUID();
  c.header("X-Request-ID", id);
  await next();
};
