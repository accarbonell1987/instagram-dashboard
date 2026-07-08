import { decodeJwt } from 'jose';

import { getAccessToken, isExpired } from './token';

// ─── Session types ──────────────────────────────────────

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  phone?: string | undefined;
  picture?: string | undefined;
  status?: string | undefined;
}

export interface SessionTenant {
  id: string;
  slug: string;
  name?: string | undefined;
}

export interface Session {
  user: SessionUser;
  tenant: SessionTenant;
  role: string;
  accessToken: string;
  expiresAt: number;
}

export interface SessionState {
  status: 'unauthenticated' | 'authenticated' | 'refreshing';
  session: Session | null;
}

// ─── Internal state ────────────────────────────────────

let state: SessionState = { status: 'unauthenticated', session: null };
const listeners = new Set<(state: SessionState) => void>();

// ─── Public API ────────────────────────────────────────

export function getSessionState(): SessionState {
  return state;
}

export function setSessionState(next: SessionState): void {
  state = next;
  for (const listener of listeners) {
    listener(state);
  }
}

export function subscribe(listener: (state: SessionState) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ─── Tenant name update helper ─────────────────────────

export function updateTenantName(name: string): void {
  if (state.status !== 'authenticated' || state.session === null) return;
  setSessionState({
    ...state,
    session: {
      ...state.session,
      tenant: { ...state.session.tenant, name },
    },
  });
}

// ─── Session bootstrap helper ──────────────────────────
// Call this after a successful login/refresh to build a SessionState
// from the current tokenHolder. Does NOT fetch /auth/me — caller's
// responsibility to enrich user fields via a subsequent API call.

export function buildSessionFromToken(): SessionState {
  const token = getAccessToken();
  if (token === null || isExpired(token)) {
    return { status: 'unauthenticated', session: null };
  }

  try {
    const claims = decodeJwt(token.raw);
    const sub = typeof claims.sub === 'string' ? claims.sub : 'unknown';
    const email = typeof claims['email'] === 'string' ? claims['email'] : '';
    // tenant_uuid is the real UUID; tenant_slug (= tenant_id) is the short slug.
    // SessionTenant.id = UUID (primary key), SessionTenant.slug = short slug.
    const tenantUuid = typeof claims['tenant_uuid'] === 'string' ? claims['tenant_uuid'] : '';
    const tenantSlug =
      typeof claims['tenant_slug'] === 'string'
        ? claims['tenant_slug']
        : typeof claims['tenant_id'] === 'string'
          ? claims['tenant_id']
          : '';
    const tenantName =
      typeof claims['tenant_name'] === 'string' ? claims['tenant_name'] : undefined;
    const role = typeof claims['role'] === 'string' ? claims['role'] : 'User';
    const fullName = typeof claims['name'] === 'string' ? claims['name'] : email;
    const phone = typeof claims['phone'] === 'string' ? claims['phone'] : undefined;
    const status = typeof claims['user_status'] === 'string' ? claims['user_status'] : undefined;

    const session: Session = {
      user: { id: sub, email, fullName, phone, status },
      tenant: { id: tenantUuid, slug: tenantSlug, name: tenantName },
      role,
      accessToken: token.raw,
      expiresAt: token.expiresAt,
    };

    return { status: 'authenticated', session };
  } catch {
    return { status: 'unauthenticated', session: null };
  }
}
