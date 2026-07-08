import { getSessionState, setSessionState, subscribe } from './store';
import type { SessionState } from './store';
import { clearAccessToken } from './token';

const CHANNEL_NAME = 'hub-session';

type BroadcastMessage =
  | { type: 'sign-out' }
  | { type: 'session-update'; sessionState: SessionState };

/**
 * Starts cross-tab session synchronisation via BroadcastChannel.
 * SSR-safe: returns a no-op stop() if BroadcastChannel is unavailable.
 *
 * Outgoing: sign-out and session-update are broadcast to other tabs.
 * Incoming: sign-out clears local token + sets unauthenticated.
 *           session-update is logged only (v1 — receiver does not trust
 *           unverified state from another tab without a fresh /auth/refresh).
 *
 * @returns stop — call to close the channel and unsubscribe listeners.
 */
export function startSessionBroadcast(): () => void {
  if (
    typeof window === 'undefined' ||
    !('BroadcastChannel' in window)
  ) {
    return () => { /* no-op SSR */ };
  }

  const channel = new BroadcastChannel(CHANNEL_NAME);

  // Outgoing: subscribe to local state changes and broadcast
  const unsubscribe = subscribe((nextState) => {
    const message: BroadcastMessage =
      nextState.status === 'unauthenticated'
        ? { type: 'sign-out' }
        : { type: 'session-update', sessionState: nextState };
    try {
      channel.postMessage(message);
    } catch {
      // Channel may be closed during cleanup — ignore
    }
  });

  // Incoming: react to messages from other tabs
  channel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
    const message = event.data;
    if (message.type === 'sign-out') {
      // Only clear if we are currently authenticated to avoid loops.
      //
      // Loop-safety analysis: when setSessionState({ unauthenticated }) is called
      // here, our outgoing subscriber (above) fires and posts another 'sign-out'
      // message. That secondary message is received by OTHER tabs, not by us,
      // because BroadcastChannel does NOT deliver messages to the sender tab.
      // Additionally, the guard `status !== 'unauthenticated'` ensures that even
      // if the same tab somehow received its own message, subsequent calls would
      // be no-ops. The redundant broadcast is harmless because 'sign-out' is
      // idempotent — setting unauthenticated when already unauthenticated is safe.
      if (getSessionState().status !== 'unauthenticated') {
        clearAccessToken();
        setSessionState({ status: 'unauthenticated', session: null });
      }
    }
    // 'session-update': no-op for v1 — other tabs must do their own refresh
    // to validate state rather than trusting unverified cross-tab state.
  };

  return () => {
    unsubscribe();
    channel.onmessage = null;
    channel.close();
  };
}
