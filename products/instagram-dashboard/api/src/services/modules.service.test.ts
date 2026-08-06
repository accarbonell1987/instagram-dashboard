import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ModulesService } from './modules.service.js';

const TENANT_ID = 'b3e4c5d6-e7f8-4a9b-a0c1-d2e3f4a5b6c7';
const USER_ID = 'user-1';

describe('ModulesService', () => {
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

    const service = new ModulesService('http://iam-internal:8080');
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

    const service = new ModulesService('http://iam-internal:8080');
    const moduleIds = await service.getAccessibleModuleIds(TENANT_ID, USER_ID);

    expect(moduleIds).toEqual([]);
    vi.unstubAllGlobals();
  });

  it('throws when api-iam is unreachable or errors (fail closed for the caller to handle)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);

    const service = new ModulesService('http://iam-internal:8080');
    await expect(service.getAccessibleModuleIds(TENANT_ID, USER_ID)).rejects.toThrow();

    vi.unstubAllGlobals();
  });
});
