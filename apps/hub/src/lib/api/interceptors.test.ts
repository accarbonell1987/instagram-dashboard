import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearAccessToken, setAccessToken } from '../../modules/iam/identity/session/token';

import { AuthError } from './errors';
import { apiFetchWithInterceptors } from './interceptors';

// ─── JWT test helper ─────────────────────────────────────
// Builds a minimal valid JWT string with an exp claim.
// Not cryptographically signed — decodeJwt() only base64-decodes the payload.
function makeJwt(expSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payload = btoa(
    JSON.stringify({ sub: 'u1', tenant_id: 'acme', tenant_uuid: 'uuid-1', tenant_slug: 'acme', role: 'User', exp: expSeconds, iat: expSeconds - 900 })
  ).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${header}.${payload}.fakesig`;
}

const FUTURE_EXP = Math.floor(Date.now() / 1000) + 900;
const VALID_JWT = makeJwt(FUTURE_EXP);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function makeResponse(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8080');
  clearAccessToken();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  clearAccessToken();
});

describe('auto Idempotency-Key injection', () => {
  it('adds Idempotency-Key on POST', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse({ ok: true }, 200));
    await apiFetchWithInterceptors('/drafts', { method: 'POST', body: {} });
    const call = fetchSpy.mock.calls[0];
    if (!call) throw new Error('expected fetch to be called');
    const [, init] = call;
    const headers = (init as { headers: Record<string, string> }).headers;
    expect(headers['Idempotency-Key']).toMatch(UUID_REGEX);
  });

  it('adds Idempotency-Key on PATCH', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse({}, 200));
    await apiFetchWithInterceptors('/drafts/1', { method: 'PATCH', body: {} });
    const call = fetchSpy.mock.calls[0];
    if (!call) throw new Error('expected fetch to be called');
    const [, init] = call;
    const headers = (init as { headers: Record<string, string> }).headers;
    expect(headers['Idempotency-Key']).toMatch(UUID_REGEX);
  });

  it('adds Idempotency-Key on PUT', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse({}, 200));
    await apiFetchWithInterceptors('/resources/1', { method: 'PUT', body: {} });
    const call = fetchSpy.mock.calls[0];
    if (!call) throw new Error('expected fetch to be called');
    const [, init] = call;
    const headers = (init as { headers: Record<string, string> }).headers;
    expect(headers['Idempotency-Key']).toMatch(UUID_REGEX);
  });

  it('adds Idempotency-Key on DELETE', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse({}, 200));
    await apiFetchWithInterceptors('/resources/1', { method: 'DELETE' });
    const call = fetchSpy.mock.calls[0];
    if (!call) throw new Error('expected fetch to be called');
    const [, init] = call;
    const headers = (init as { headers: Record<string, string> }).headers;
    expect(headers['Idempotency-Key']).toMatch(UUID_REGEX);
  });

  it('does NOT add Idempotency-Key on GET', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse([], 200));
    await apiFetchWithInterceptors('/plans', { method: 'GET' });
    const call = fetchSpy.mock.calls[0];
    if (!call) throw new Error('expected fetch to be called');
    const [, init] = call;
    const headers = (init as { headers: Record<string, string> }).headers;
    expect(headers['Idempotency-Key']).toBeUndefined();
  });
});

describe('401 refresh-retry single-flight', () => {
  it('on 401: triggers refresh, retry succeeds, returns data', async () => {
    setAccessToken({ raw: 'expired.token', expiresAt: Date.now() + 60_000 });

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(makeResponse({ title: 'Unauthorized' }, 401, { 'Content-Type': 'application/problem+json' }))
      .mockResolvedValueOnce(makeResponse({ accessToken: VALID_JWT, expiresIn: 900 }, 200))
      .mockResolvedValueOnce(makeResponse({ id: '1' }, 200));

    const result = await apiFetchWithInterceptors<{ id: string }>('/plans/1');
    expect(result).toEqual({ id: '1' });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('on 401 + refresh fails: throws AuthError', async () => {
    setAccessToken({ raw: 'expired.token', expiresAt: Date.now() + 60_000 });

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(makeResponse({ title: 'Unauthorized' }, 401, { 'Content-Type': 'application/problem+json' }))
      .mockResolvedValueOnce(makeResponse({ title: 'Unauthorized' }, 401, { 'Content-Type': 'application/problem+json' }));

    await expect(apiFetchWithInterceptors('/plans/1')).rejects.toBeInstanceOf(AuthError);
  });

  it('two concurrent 401s share a single refresh call', async () => {
    setAccessToken({ raw: 'expired.token', expiresAt: Date.now() + 60_000 });

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(makeResponse({ title: 'Unauthorized' }, 401, { 'Content-Type': 'application/problem+json' }))
      .mockResolvedValueOnce(makeResponse({ title: 'Unauthorized' }, 401, { 'Content-Type': 'application/problem+json' }))
      .mockResolvedValueOnce(makeResponse({ accessToken: VALID_JWT, expiresIn: 900 }, 200))
      .mockResolvedValueOnce(makeResponse({ id: '1' }, 200))
      .mockResolvedValueOnce(makeResponse({ id: '2' }, 200));

    const [result1, result2] = await Promise.all([
      apiFetchWithInterceptors<{ id: string }>('/plans/1'),
      apiFetchWithInterceptors<{ id: string }>('/plans/2'),
    ]);

    expect(result1).toEqual({ id: '1' });
    expect(result2).toEqual({ id: '2' });

    const refreshCalls = fetchSpy.mock.calls.filter(([url]) => {
      const urlString = url instanceof URL ? url.href : url instanceof Request ? url.url : url;
      return urlString.includes('/auth/refresh');
    });
    expect(refreshCalls).toHaveLength(1);
  });
});
