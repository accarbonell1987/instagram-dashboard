import { AuthError } from '../../../../lib/api/errors';

import { setSessionState, buildSessionFromToken } from './store';
import { setAccessToken, clearAccessToken, fromJwt, getAccessToken } from './token';

// ─── Refresh response shape ─────────────────────────────

interface RefreshResponse {
  accessToken: string;
  expiresIn: number; // kept for API contract completeness; expiresAt is derived from JWT exp claim
}

// ─── Single-flight state ────────────────────────────────

let inflight: Promise<void> | null = null;

// ─── Internal refresh execution ─────────────────────────
//
// IMPORTANT: /auth/refresh uses rotating refresh tokens. A 5xx response does NOT
// mean the token is still valid — the backend may have already rotated it before
// the transaction timed out. Retrying would send the same (now-invalidated) token
// and trigger a refresh_family_compromised response, invalidating the entire family.
// Therefore we NEVER retry on any failure from this endpoint.

async function executeRefresh(): Promise<void> {
  // Snapshot the token present when refresh starts. If a newer token is set
  // while the refresh is in-flight (e.g. submitDraft on the onboarding summary),
  // we must NOT overwrite or clear it on failure.
  const tokenAtStart = getAccessToken();

  const baseUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';
  const response = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    // Only reset state if no newer token was set while we were in-flight.
    // Race condition: submitDraft (onboarding) may have set a valid token
    // between when AuthProvider triggered this refresh and when it failed.
    if (getAccessToken() === tokenAtStart) {
      clearAccessToken();
      setSessionState({ status: 'unauthenticated', session: null });
    }
    // Throw AuthError so the interceptor chain recognises this as an auth failure
    // and doesn't attempt further retries.
    throw new AuthError('Refresh failed', '/auth/refresh', 'session_expired');
  }

  const data = (await response.json()) as RefreshResponse;
  // Use the JWT's own exp claim rather than Date.now() + expiresIn to avoid
  // clock skew between server-issued time and client-observed time.
  setAccessToken(fromJwt(data.accessToken));
  setSessionState(buildSessionFromToken());
}

// ─── Public API ────────────────────────────────────────

/**
 * Single-flight session refresh. Concurrent callers share one in-flight promise.
 * On success: updates tokenHolder + sessionState.
 * On failure: clears tokenHolder, sets sessionState to unauthenticated, throws AuthError.
 */
export async function refreshSession(): Promise<void> {
  if (inflight !== null) {
    return inflight;
  }

  inflight = executeRefresh().finally(() => {
    inflight = null;
  });

  return inflight;
}

export function isRefreshing(): boolean {
  return inflight !== null;
}
