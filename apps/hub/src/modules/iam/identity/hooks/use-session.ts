'use client';

import { useSyncExternalStore } from 'react';

import { getSessionState, subscribe } from '../session/store';
import type { SessionState } from '../session/store';

/**
 * Stable reference for the server snapshot — must NOT be created inline
 * or React will detect a new object on every call and throw:
 * "The result of getServerSnapshot should be cached to avoid an infinite loop"
 */
const SERVER_SNAPSHOT: SessionState = { status: 'unauthenticated', session: null };

/**
 * Returns the current SessionState and re-renders whenever it changes.
 * SSR-safe: returns unauthenticated snapshot on the server.
 */
export function useSession(): SessionState {
  return useSyncExternalStore(
    subscribe,
    getSessionState,
    // Server snapshot — always unauthenticated (session lives in memory, not on server)
    () => SERVER_SNAPSHOT
  );
}
