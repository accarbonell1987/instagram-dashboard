'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ReactElement,
  type ReactNode,
} from 'react';

import { apiFetch } from '@/lib/api/client';
import { generateIdempotencyKey } from '@/lib/api/idempotency';
import { useSession } from '@/modules/iam/identity/hooks/use-session';
import { startSessionBroadcast } from '@/modules/iam/identity/session/broadcast';
import { refreshSession } from '@/modules/iam/identity/session/refresh';
import { getSessionState, setSessionState } from '@/modules/iam/identity/session/store';
import type { SessionState } from '@/modules/iam/identity/session/store';
import {
  clearAccessToken,
  getAccessToken,
  isExpired,
  subscribeToToken,
} from '@/modules/iam/identity/session/token';

// ─── Context shape ──────────────────────────────────────

interface AuthContextValue {
  session: SessionState;
  signOut: () => Promise<void>;
  subscribeToToken: typeof subscribeToToken;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── AuthProvider ───────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): ReactElement {
  const session = useSession();

  // Bootstrap: attempt silent refresh on mount if we have no session yet
  useEffect(() => {
    const token = getAccessToken();
    const currentState = getSessionState();

    if (currentState.status === 'unauthenticated' && (token === null || isExpired(token))) {
      // Attempt silent refresh — ignore failure (user stays unauthenticated)
      setSessionState({ status: 'refreshing', session: null });
      refreshSession().catch(() => {
        // refreshSession already sets state to unauthenticated on failure
      });
    }
  }, []); // Run once on mount

  // Multi-tab sync
  useEffect(() => {
    const stop = startSessionBroadcast();
    return stop;
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
        idempotencyKey: generateIdempotencyKey(),
      });
    } catch {
      // Logout best-effort — always clear local state even if API call fails
    } finally {
      clearAccessToken();
      setSessionState({ status: 'unauthenticated', session: null });
    }
  }, []);

  const value: AuthContextValue = {
    session,
    signOut,
    subscribeToToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── useAuth hook ───────────────────────────────────────

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}

export { AuthContext };
