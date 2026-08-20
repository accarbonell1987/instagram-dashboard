import { createMiddleware } from 'hono/factory';

import { RateLimitError } from '../errors.js';
import { FixedWindowRateLimiter } from '../shared/lib/rate-limiter.js';

/**
 * Instagram's own budget: roughly 200 calls an hour per token, held at 190.
 *
 * The counting lives in `FixedWindowRateLimiter`, which `SyncService` uses too.
 * This module had its own copy of it — the same rule, written twice, for the
 * same limit.
 */
const limiter = new FixedWindowRateLimiter(190, 3_600_000);

export const rateLimitMiddleware = createMiddleware(async (c, next) => {
  const tenant = c.get('tenant');
  const key = `ig:${tenant.tenantId}`;

  if (!limiter.allows(key)) {
    throw new RateLimitError(limiter.retryAfterSeconds(key));
  }
  limiter.record(key);

  await next();
});
