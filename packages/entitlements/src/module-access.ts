import { Hono } from 'hono';

interface TenantVariables {
  Variables: { tenant: { tenantId: string; userId: string } };
}

/**
 * Thrown when the upstream (api-iam) module lookup fails. The product's own
 * error handler decides how to render this (typically a generic 500) — this
 * package doesn't own product-facing error copy.
 */
export class EntitlementsLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EntitlementsLookupError';
  }
}

/**
 * Resolves which of a product's own modules the current tenant/user is
 * entitled to. Calls api-iam's internal entitlements endpoint instead of
 * re-implementing plan/override/trial resolution here — api-iam is the
 * authority (resolveEffectiveModules fails closed on tenant status).
 */
export class ModuleAccessService {
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(
    private readonly productId: string,
    private readonly iamBaseUrl: string,
  ) {
    this.fetchFn = globalThis.fetch.bind(globalThis);
  }

  async getAccessibleModuleIds(tenantId: string, userId: string): Promise<string[]> {
    const url = new URL(`/internal/tenants/${tenantId}/entitlements`, this.iamBaseUrl);
    url.searchParams.set('productId', this.productId);
    url.searchParams.set('userId', userId);

    const res = await this.fetchFn(url);
    if (!res.ok) {
      throw new EntitlementsLookupError(`iam entitlements lookup failed: ${String(res.status)}`);
    }

    const body = (await res.json()) as { modules?: { id: string }[] };
    return (body.modules ?? []).map((m) => m.id);
  }
}

/**
 * Route factory for "which of my own modules can I see" — mirrors
 * createEntitlementsPurgeRoute's shape. Mount at whatever prefix the product
 * wants its module-listing endpoint to live at (e.g. `/me`, behind auth +
 * entitlementGuard).
 */
export function createModuleAccessRoute(service: ModuleAccessService): Hono<TenantVariables> {
  const router = new Hono<TenantVariables>();

  router.get('/modules', async (c) => {
    const tenant = c.get('tenant');
    const { tenantId, userId } = tenant;

    const moduleIds = await service.getAccessibleModuleIds(tenantId, userId);

    return c.json({ success: true, data: { moduleIds } }, 200);
  });

  return router;
}
