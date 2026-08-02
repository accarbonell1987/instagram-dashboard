'use client';

// postMessage handshake with the Corehub hub, which loads this app in a
// cross-origin iframe. The hub is the token authority: it pushes the JWT via
// `corehub.hub.v1.token` and clears it on `corehub.hub.v1.signOut`. This module
// holds the current token so instagram.service can attach it as a bearer.
//
// The message names/shapes MUST match hub's post-message-protocol.ts exactly
// (apps/hub/src/modules/shared/modules/lib/post-message-protocol.ts). They are
// re-declared here rather than imported to avoid coupling to hub's `@/` paths.

const HUB_TO_MODULE = {
  token: 'corehub.hub.v1.token',
  signOut: 'corehub.hub.v1.signOut',
} as const;

const MODULE_TO_HUB = {
  ready: 'corehub.module.v1.ready',
  requestToken: 'corehub.module.v1.requestToken',
} as const;

// Hub origin to trust and to post to. Configurable per environment; dev default
// mirrors the hub's port (3001).
const HUB_ORIGIN = process.env['NEXT_PUBLIC_HUB_ORIGIN'] ?? 'http://localhost:3001';

let currentToken: string | null = null;

/** The JWT last received from the hub, or null if none has arrived yet. */
export function getHubToken(): string | null {
  return currentToken;
}

/** Drop the stored token (e.g. after a 401). The hub re-sends on next sign-in. */
export function clearHubToken(): void {
  currentToken = null;
}

function isTrustedOrigin(origin: string): boolean {
  if (origin === HUB_ORIGIN) return true;
  // Standalone / tests: the app isn't framed by the hub, so same-origin
  // messages are the only ones that can carry a token.
  if (typeof window !== 'undefined' && origin === window.location.origin) return true;
  return false;
}

function handleMessage(event: MessageEvent): void {
  if (!isTrustedOrigin(event.origin)) return;

  const data = event.data as { type?: unknown; token?: unknown } | null;
  if (data === null || typeof data !== 'object') return;

  if (data.type === HUB_TO_MODULE.token && typeof data.token === 'string') {
    currentToken = data.token;
  } else if (data.type === HUB_TO_MODULE.signOut) {
    currentToken = null;
  }
}

/**
 * Start listening for hub messages and announce readiness. Idempotent per
 * listener via the returned cleanup — call once from a client effect:
 * `useEffect(() => initHubToken(), [])`. No-op during SSR.
 */
export function initHubToken(): () => void {
  if (typeof window === 'undefined') return () => undefined;

  window.addEventListener('message', handleMessage);
  // Tell the hub we're mounted and ask it to send the current token.
  window.parent.postMessage({ type: MODULE_TO_HUB.ready }, HUB_ORIGIN);
  window.parent.postMessage({ type: MODULE_TO_HUB.requestToken }, HUB_ORIGIN);

  return () => {
    window.removeEventListener('message', handleMessage);
  };
}
