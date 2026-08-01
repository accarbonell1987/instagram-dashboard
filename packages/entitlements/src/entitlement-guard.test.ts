import { Hono } from 'hono';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { entitlementGuard, createEntitlementsPurgeRoute } from './entitlement-guard.js';

const IAM_BASE_URL = 'http://iam.test';

function makeApp(guard: ReturnType<typeof entitlementGuard>, tenantId = 'tenant-1') {
  const app = new Hono<{ Variables: { tenant: { tenantId: string } } }>();
  app.use('*', async (c, next) => {
    c.set('tenant', { tenantId });
    await next();
  });
  app.use('*', guard);
  app.get('/protected', (c) => c.json({ ok: true }));
  return app;
}

describe('entitlementGuard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('denies by default (403) when iam reports no active entitlement', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ allowed: false, source: null }) });

    const guard = entitlementGuard({ productId: 'instagram-dashboard', iamBaseUrl: IAM_BASE_URL });
    const app = makeApp(guard);

    const res = await app.request('/protected');

    expect(res.status).toBe(403);
  });

  it.each(['plan', 'override', 'trial', 'admin'])('allows access when iam reports an active %s grant', async (source) => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ allowed: true, source }) });

    const guard = entitlementGuard({ productId: 'instagram-dashboard', iamBaseUrl: IAM_BASE_URL });
    const app = makeApp(guard);

    const res = await app.request('/protected');

    expect(res.status).toBe(200);
  });

  it('re-fetches from iam once the cache TTL expires (expiry enforced at request time)', async () => {
    vi.useFakeTimers();
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ allowed: true, source: 'trial' }) });

    const guard = entitlementGuard({
      productId: 'instagram-dashboard',
      iamBaseUrl: IAM_BASE_URL,
      cacheTtlMs: 1_000,
    });
    const app = makeApp(guard);

    await app.request('/protected');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_001);

    await app.request('/protected');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('serves from cache on a hit within the TTL (no re-fetch)', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ allowed: true, source: 'plan' }) });

    const guard = entitlementGuard({ productId: 'instagram-dashboard', iamBaseUrl: IAM_BASE_URL });
    const app = makeApp(guard);

    await app.request('/protected');
    await app.request('/protected');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('purgeCache forces a re-fetch even within the TTL, reflecting a revoke', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ allowed: true, source: 'override' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ allowed: false, source: null }) });

    const guard = entitlementGuard({ productId: 'instagram-dashboard', iamBaseUrl: IAM_BASE_URL });
    const app = makeApp(guard);

    const first = await app.request('/protected');
    expect(first.status).toBe(200);

    guard.purgeCache('tenant-1', 'instagram-dashboard');

    const second = await app.request('/protected');
    expect(second.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails closed (403) when iam is unreachable', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const guard = entitlementGuard({ productId: 'instagram-dashboard', iamBaseUrl: IAM_BASE_URL });
    const app = makeApp(guard);

    const res = await app.request('/protected');

    expect(res.status).toBe(403);
  });

  it('fails closed (403) when iam responds with a non-2xx status', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) });

    const guard = entitlementGuard({ productId: 'instagram-dashboard', iamBaseUrl: IAM_BASE_URL });
    const app = makeApp(guard);

    const res = await app.request('/protected');

    expect(res.status).toBe(403);
  });
});

describe('createEntitlementsPurgeRoute', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('purges the guard cache for a tenant and returns 200', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ allowed: true, source: 'plan' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ allowed: false, source: null }) });

    const guard = entitlementGuard({ productId: 'instagram-dashboard', iamBaseUrl: IAM_BASE_URL });
    const app = makeApp(guard);
    const purgeApp = createEntitlementsPurgeRoute(guard);

    await app.request('/protected'); // populate cache

    const purgeRes = await purgeApp.request('/internal/entitlements/purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: 'tenant-1', productId: 'instagram-dashboard' }),
    });

    expect(purgeRes.status).toBe(200);
    const body = (await purgeRes.json()) as { success: boolean; data: { purged: boolean } };
    expect(body.success).toBe(true);
    expect(body.data.purged).toBe(true);

    const afterPurge = await app.request('/protected');
    expect(afterPurge.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('tolerates a missing/empty body (purges everything)', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ allowed: true, source: 'plan' }) });

    const guard = entitlementGuard({ productId: 'instagram-dashboard', iamBaseUrl: IAM_BASE_URL });
    const purgeApp = createEntitlementsPurgeRoute(guard);

    const res = await purgeApp.request('/internal/entitlements/purge', { method: 'POST' });

    expect(res.status).toBe(200);
  });
});
