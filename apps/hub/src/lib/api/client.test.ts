import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setAccessToken, clearAccessToken } from '../../modules/iam/identity/session/token';

import { apiFetch } from './client';
import { ApiError, AuthError, ForbiddenError, RateLimitError, ValidationError } from './errors';

const BASE_URL = 'http://localhost:8080';

function makeResponse(
  body: unknown,
  status: number,
  headers: Record<string, string> = {}
): Response {
  const allHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };
  return new Response(JSON.stringify(body), { status, headers: allHeaders });
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', BASE_URL);
  clearAccessToken();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  clearAccessToken();
});

describe('apiFetch', () => {
  it('builds URL from base + path', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(makeResponse({ ok: true }, 200));
    await apiFetch('/plans');
    expect(fetchSpy).toHaveBeenCalledWith(`${BASE_URL}/plans`, expect.any(Object));
  });

  it('sends body as JSON on POST', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(makeResponse({ id: '1' }, 201));
    await apiFetch('/drafts', { method: 'POST', body: { planId: 'abc' } });
    const call = fetchSpy.mock.calls[0];
    if (!call) throw new Error('expected fetch to be called');
    const [, init] = call;
    if (!init) throw new Error('expected init to be defined');
    expect(init.body).toBe(JSON.stringify({ planId: 'abc' }));
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('parses JSON response on 2xx', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse({ id: '1', name: 'Pro' }, 200));
    const result = await apiFetch<{ id: string; name: string }>('/plans/1');
    expect(result).toEqual({ id: '1', name: 'Pro' });
  });

  it('injects Authorization header when access token is present', async () => {
    setAccessToken({ raw: 'test.access.token', expiresAt: Date.now() + 60_000 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse({}, 200));
    await apiFetch('/plans');
    const call = fetchSpy.mock.calls[0];
    if (!call) throw new Error('expected fetch to be called');
    const [, init] = call;
    if (!init) throw new Error('expected init to be defined');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer test.access.token',
    });
  });

  it('does NOT inject Authorization header when no token', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse({}, 200));
    await apiFetch('/plans');
    const call = fetchSpy.mock.calls[0];
    if (!call) throw new Error('expected fetch to be called');
    const [, init] = call;
    if (!init) throw new Error('expected init to be defined');
    expect(init.headers).not.toMatchObject({ Authorization: expect.any(String) as unknown });
  });

  it('throws AuthError on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeResponse({ title: 'Unauthorized' }, 401, { 'Content-Type': 'application/problem+json' })
    );
    await expect(apiFetch('/plans')).rejects.toBeInstanceOf(AuthError);
  });

  it('throws ForbiddenError on 403', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeResponse({ title: 'Forbidden' }, 403, { 'Content-Type': 'application/problem+json' })
    );
    const error = await apiFetch('/plans').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ForbiddenError);
    expect((error as ForbiddenError).status).toBe(403);
  });

  it('throws ValidationError with errors array on 422 problem+json', async () => {
    const problem = {
      type: 'https://corehub.com/errors/validation',
      title: 'Validation Error',
      status: 422,
      errors: [{ field: 'email', code: 'invalid_format', message: 'Invalid email format' }],
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeResponse(problem, 422, { 'Content-Type': 'application/problem+json' })
    );
    const error = await apiFetch('/drafts').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).errors).toEqual([
      { field: 'email', code: 'invalid_format', message: 'Invalid email format' },
    ]);
  });

  it('throws RateLimitError on 429 with Retry-After header', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeResponse({ title: 'Rate Limited' }, 429, {
        'Content-Type': 'application/problem+json',
        'Retry-After': '30',
      })
    );
    const error = await apiFetch('/auth/login').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).retryAfterSeconds).toBe(30);
  });

  it('throws ApiError on 500', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeResponse({ title: 'Internal Server Error' }, 500, {
        'Content-Type': 'application/problem+json',
      })
    );
    await expect(apiFetch('/plans')).rejects.toBeInstanceOf(ApiError);
  });

  it('passes AbortSignal through to fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse({}, 200));
    const controller = new AbortController();
    await apiFetch('/plans', { signal: controller.signal });
    const call = fetchSpy.mock.calls[0];
    if (!call) throw new Error('expected fetch to be called');
    const [, init] = call;
    if (!init) throw new Error('expected init to be defined');
    expect(init.signal).toBe(controller.signal);
  });
});
