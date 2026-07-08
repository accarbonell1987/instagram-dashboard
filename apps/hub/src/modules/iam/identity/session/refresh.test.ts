import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { refreshSession, isRefreshing } from './refresh';
import { getSessionState, setSessionState } from './store';
import { clearAccessToken, getAccessToken, setAccessToken } from './token';

// ─── JWT test helpers ───────────────────────────────────
// Builds a minimal valid JWT string with the given exp (Unix timestamp seconds).
// Not signed with a real key — only the structure matters for decodeJwt() in tests.
function makeJwt(expSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const payload = btoa(
    JSON.stringify({
      sub: 'user-1',
      tenant_id: 'acme',
      tenant_uuid: 'tenant-uuid-1',
      tenant_slug: 'acme',
      role: 'User',
      exp: expSeconds,
      iat: expSeconds - 900,
    })
  )
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  // Signature is arbitrary — decodeJwt only decodes, does not verify
  return `${header}.${payload}.fakesignature`;
}

// A JWT that expires well in the future
const FUTURE_EXP = Math.floor(Date.now() / 1000) + 900;
const VALID_JWT = makeJwt(FUTURE_EXP);

// Reset module-level state between tests
beforeEach(() => {
  clearAccessToken();
  setSessionState({ status: 'unauthenticated', session: null });
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeFetchMock(status: number, body: unknown): typeof fetch {
  // Each call must return a FRESH Response — Response body can only be read once.
  return vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    )
  );
}

describe('refreshSession — success', () => {
  it('calls fetch once and updates tokenHolder on success', async () => {
    const mockFetch = makeFetchMock(200, { accessToken: VALID_JWT, expiresIn: 900 });
    vi.stubGlobal('fetch', mockFetch);

    await refreshSession();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const token = getAccessToken();
    expect(token?.raw).toBe(VALID_JWT);
  });

  it('derives expiresAt from JWT exp claim (not Date.now + expiresIn)', async () => {
    const mockFetch = makeFetchMock(200, { accessToken: VALID_JWT, expiresIn: 900 });
    vi.stubGlobal('fetch', mockFetch);

    await refreshSession();

    const token = getAccessToken();
    // expiresAt should be derived from JWT exp * 1000
    expect(token?.expiresAt).toBe(FUTURE_EXP * 1000);
  });

  it('sets sessionState to authenticated on success with valid JWT', async () => {
    const mockFetch = makeFetchMock(200, { accessToken: VALID_JWT, expiresIn: 900 });
    vi.stubGlobal('fetch', mockFetch);

    await refreshSession();

    const s = getSessionState();
    expect(s.status).toBe('authenticated');
  });

  it('after settle, next call starts a fresh refresh (not cached)', async () => {
    const mockFetch = makeFetchMock(200, { accessToken: VALID_JWT, expiresIn: 900 });
    vi.stubGlobal('fetch', mockFetch);

    await refreshSession();
    await refreshSession();

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('refreshSession — concurrent calls share one in-flight', () => {
  it('two concurrent calls result in a single fetch', async () => {
    const mockFetch = makeFetchMock(200, { accessToken: VALID_JWT, expiresIn: 900 });
    vi.stubGlobal('fetch', mockFetch);

    const [, ] = await Promise.all([refreshSession(), refreshSession()]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe('refreshSession — failure', () => {
  it('clears tokenHolder and sets unauthenticated state on 401', async () => {
    setAccessToken({ raw: 'old-token', expiresAt: Date.now() + 60_000 });
    const mockFetch = makeFetchMock(401, { title: 'Unauthorized' });
    vi.stubGlobal('fetch', mockFetch);

    await expect(refreshSession()).rejects.toThrow();

    expect(getAccessToken()).toBeNull();
    expect(getSessionState().status).toBe('unauthenticated');
  });

  it('clears tokenHolder and sets unauthenticated state on 500 (no retry)', async () => {
    setAccessToken({ raw: 'old-token', expiresAt: Date.now() + 60_000 });
    const mockFetch = makeFetchMock(500, { title: 'Server error' });
    vi.stubGlobal('fetch', mockFetch);

    await expect(refreshSession()).rejects.toThrow();

    // No retry — rotating refresh tokens make retries dangerous.
    // A 500 may mean the token was already rotated before the transaction timed out.
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
    expect(getSessionState().status).toBe('unauthenticated');
  });

  it('throws AuthError on failure', async () => {
    const mockFetch = makeFetchMock(401, { title: 'Unauthorized' });
    vi.stubGlobal('fetch', mockFetch);

    const { AuthError } = await import('../../../../lib/api/errors');
    await expect(refreshSession()).rejects.toBeInstanceOf(AuthError);
  });

  it('preserves a token set during in-flight refresh (race condition with submitDraft)', async () => {
    // Simulate: AuthProvider starts refresh (no token), then submitDraft sets a token
    // while the refresh is awaiting. When the refresh fails it must NOT clear the new token.
    const newToken = { raw: VALID_JWT, expiresAt: FUTURE_EXP * 1000 };

    const mockFetch = vi.fn().mockImplementation(async () => {
      // While the fetch is "in flight", simulate submitDraft setting a token
      setAccessToken(newToken);
      return new Response(JSON.stringify({ title: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(refreshSession()).rejects.toThrow();

    // The token set by submitDraft must survive the failed refresh
    expect(getAccessToken()).toBe(newToken);
  });
});

describe('isRefreshing', () => {
  it('returns false when not refreshing', () => {
    expect(isRefreshing()).toBe(false);
  });
});
