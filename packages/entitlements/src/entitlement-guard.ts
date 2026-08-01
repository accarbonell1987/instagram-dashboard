import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { createMiddleware } from 'hono/factory';

export interface EntitlementGuardOptions {
  productId: string;
  moduleId?: string;
  iamBaseUrl: string;
  cacheTtlMs?: number;
}

interface CacheEntry {
  allowed: boolean;
  fetchedAt: number;
}

interface TenantVariables {
  Variables: { tenant: { tenantId: string } };
}

export type EntitlementGuardHandler = MiddlewareHandler<TenantVariables> & {
  purgeCache: (tenantId?: string, productId?: string) => void;
};

const DEFAULT_CACHE_TTL_MS = 60_000;

/**
 * Hono middleware enforcing product/module entitlements. Mirrors
 * UsageTracker's fetch+cache pattern (60s TTL), but is FAIL-CLOSED
 * (owner-confirmed, apply-signoff #1672): any iam-unreachable/error/deny
 * response denies access — this is an authorization boundary, not a
 * usage-limit soft-check.
 */
export function entitlementGuard(opts: EntitlementGuardOptions): EntitlementGuardHandler {
  const cache = new Map<string, CacheEntry>();
  const ttl = opts.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;

  async function resolveAllowed(tenantId: string): Promise<boolean> {
    const cacheKey = `${tenantId}:${opts.productId}:${opts.moduleId ?? ''}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < ttl) {
      return cached.allowed;
    }

    try {
      const url = new URL(`/internal/tenants/${tenantId}/entitlements`, opts.iamBaseUrl);
      url.searchParams.set('productId', opts.productId);
      if (opts.moduleId) url.searchParams.set('moduleId', opts.moduleId);

      const res = await fetch(url);
      if (!res.ok) throw new Error(`iam entitlements check failed: ${String(res.status)}`);

      const data = (await res.json()) as { allowed: boolean };
      cache.set(cacheKey, { allowed: data.allowed, fetchedAt: Date.now() });
      return data.allowed;
    } catch {
      // Fail-closed: deny access when iam is unreachable or errors.
      return false;
    }
  }

  const handler = createMiddleware<TenantVariables>(async (c, next) => {
    const tenant = c.get('tenant');
    const allowed = await resolveAllowed(tenant.tenantId);

    if (!allowed) {
      return c.json(
        {
          success: false,
          error: { code: 'ENTITLEMENT_REQUIRED', message: 'No active entitlement for this module' },
        },
        403,
      );
    }

    await next();
  }) as EntitlementGuardHandler;

  handler.purgeCache = (tenantId, productId) => {
    if (!tenantId) {
      cache.clear();
      return;
    }
    const prefix = `${tenantId}:${productId ?? opts.productId}:`;
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) cache.delete(key);
    }
  };

  return handler;
}

/**
 * Purge-direction correction (owner-resolved): the entitlement cache lives
 * in this guard, so the purge route is hosted here — the product API
 * mounts it, and api-iam CALLS it on entitlement-mutating writes
 * (mirrors the existing /internal/quotas/purge fan-out).
 */
export function createEntitlementsPurgeRoute(guard: EntitlementGuardHandler): Hono {
  const router = new Hono();

  router.post('/internal/entitlements/purge', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { tenantId?: string; productId?: string };
    guard.purgeCache(body.tenantId, body.productId);
    return c.json({ success: true, data: { purged: true } }, 200);
  });

  return router;
}
