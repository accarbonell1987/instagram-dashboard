import { InternalError } from '../errors.js';

const PRODUCT_ID = 'instagram-dashboard';

/**
 * Resolves which of this product's own modules the current tenant/user is
 * entitled to. Calls api-iam's internal entitlements endpoint instead of
 * re-implementing plan/override/trial resolution here — api-iam is the
 * authority (resolveEffectiveModules fails closed on tenant status).
 */
export class ModulesService {
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(private readonly iamBaseUrl: string) {
    this.fetchFn = globalThis.fetch.bind(globalThis);
  }

  async getAccessibleModuleIds(tenantId: string, userId: string): Promise<string[]> {
    const url = new URL(`/internal/tenants/${tenantId}/entitlements`, this.iamBaseUrl);
    url.searchParams.set('productId', PRODUCT_ID);
    url.searchParams.set('userId', userId);

    const res = await this.fetchFn(url);
    if (!res.ok) {
      throw new InternalError(`iam entitlements lookup failed: ${String(res.status)}`);
    }

    const body = (await res.json()) as { modules?: { id: string }[] };
    return (body.modules ?? []).map((m) => m.id);
  }
}
