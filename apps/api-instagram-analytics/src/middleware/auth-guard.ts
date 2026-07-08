import { createMiddleware } from 'hono/factory';
import type { TenantContext } from '../lib/jwt-verifier.js';
import { verifyAccessToken } from '../lib/jwt-verifier.js';
import { UnauthorizedError } from '../errors.js';

// Extend Hono's ContextVariableMap
declare module 'hono' {
  interface ContextVariableMap {
    tenant: TenantContext;
  }
}

export const authGuard = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }

  const token = authHeader.slice(7);
  const tenant = await verifyAccessToken(token);
  c.set('tenant', tenant);
  await next();
});
