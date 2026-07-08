import { createMiddleware } from 'hono/factory';
import { RateLimitError } from '../errors.js';

const counters = new Map<string, { count: number; windowStart: number }>();
const MAX_CALLS = 190;
const WINDOW_MS = 3600000;

export function checkRateLimit(key: string): {
  allowed: boolean;
  retryAfter?: number;
} {
  const now = Date.now();
  let counter = counters.get(key);

  if (!counter || now - counter.windowStart > WINDOW_MS) {
    counter = { count: 0, windowStart: now };
    counters.set(key, counter);
  }

  if (counter.count >= MAX_CALLS) {
    return {
      allowed: false,
      retryAfter: Math.ceil(
        (counter.windowStart + WINDOW_MS - now) / 1000,
      ),
    };
  }

  counter.count++;
  return { allowed: true };
}

export const rateLimitMiddleware = createMiddleware(async (c, next) => {
  const tenant = c.get('tenant');
  const key = `ig:${tenant.tenantId}`;

  const { allowed, retryAfter } = checkRateLimit(key);
  if (!allowed) {
    throw new RateLimitError(retryAfter ?? 3600);
  }

  await next();
});
