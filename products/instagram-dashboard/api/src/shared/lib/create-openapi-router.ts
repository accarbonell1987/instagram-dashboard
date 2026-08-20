import { OpenAPIHono } from "@hono/zod-openapi";
import type { Env } from "hono";

/**
 * Creates an OpenAPIHono router with the standard validation error hook.
 * All validation failures return { success: false, error: { code, message, details } }.
 */
export function createApiRouter<E extends Env = Env>(): OpenAPIHono<E> {
  return new OpenAPIHono<E>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Validation failed",
              details: result.error.issues,
            },
          },
          400,
        );
      }
    },
  });
}
