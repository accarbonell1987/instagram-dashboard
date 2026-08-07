import { Hono } from 'hono';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ModuleAccessService, createModuleAccessRoute, EntitlementsLookupError } from './module-access.js';

const TENANT_ID = 'b3e4c5d6-e7f8-4a9b-a0c1-d2e3f4a5b6c7';
const USER_ID = 'user-1';

describe('ModuleAccessService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the module ids resolved by api-iam for this product', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        allowed: true,
        modules: [{ id: 'ig-basic-metrics', source: 'plan' }, { id: 'ig-audience', source: 'plan' }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new ModuleAccessService('instagram-dashboard', 'http://iam-internal:8080');
    const moduleIds = await service.getAccessibleModuleIds(TENANT_ID, USER_ID);

    expect(moduleIds).toEqual(['ig-basic-metrics', 'ig-audience']);
    const calledUrl = new URL((fetchMock.mock.calls[0] as [URL])[0]);
    expect(calledUrl.origin + calledUrl.pathname).toBe(
      `http://iam-internal:8080/internal/tenants/${TENANT_ID}/entitlements`,
    );
    expect(calledUrl.searchParams.get('productId')).toBe('instagram-dashboard');
    expect(calledUrl.searchParams.get('userId')).toBe(USER_ID);

    vi.unstubAllGlobals();
  });

  it('returns an empty list when the tenant has no entitled modules', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ allowed: false, modules: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new ModuleAccessService('instagram-dashboard', 'http://iam-internal:8080');
    const moduleIds = await service.getAccessibleModuleIds(TENANT_ID, USER_ID);

    expect(moduleIds).toEqual([]);
    vi.unstubAllGlobals();
  });

  it('throws EntitlementsLookupError when api-iam is unreachable or errors (fail closed for the caller to handle)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);

    const service = new ModuleAccessService('instagram-dashboard', 'http://iam-internal:8080');
    await expect(service.getAccessibleModuleIds(TENANT_ID, USER_ID)).rejects.toThrow(EntitlementsLookupError);

    vi.unstubAllGlobals();
  });
});

describe('GET /modules (createModuleAccessRoute)', () => {
  const mockGetAccessibleModuleIds = vi.fn();
  const mockService = { getAccessibleModuleIds: mockGetAccessibleModuleIds };

  function makeApp() {
    const app = new Hono<{ Variables: { tenant: { tenantId: string; userId: string } } }>();
    app.use('*', async (c, next) => {
      c.set('tenant', { tenantId: TENANT_ID, userId: USER_ID });
      await next();
    });
    app.route('/me', createModuleAccessRoute(mockService as unknown as ModuleAccessService));
    return app;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the entitled module ids for the current tenant/user', async () => {
    mockGetAccessibleModuleIds.mockResolvedValue(['ig-basic-metrics', 'ig-audience']);

    const app = makeApp();
    const res = await app.request('/me/modules');
    const body = (await res.json()) as { success: true; data: { moduleIds: string[] } };

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, data: { moduleIds: ['ig-basic-metrics', 'ig-audience'] } });
    expect(mockGetAccessibleModuleIds).toHaveBeenCalledWith(TENANT_ID, USER_ID);
  });

  it('propagates a failure to the caller for its own error handler to render', async () => {
    mockGetAccessibleModuleIds.mockRejectedValue(new EntitlementsLookupError('iam entitlements lookup failed: 500'));

    const app = makeApp();
    const res = await app.request('/me/modules');

    // No onError registered here — this asserts on Hono's own default
    // fallback. A mounting product typically registers its own onError
    // (see products/instagram-dashboard/api) which renders this the same
    // way it renders any other thrown error.
    expect(res.status).toBe(500);
  });
});
