import { decodeJwt } from 'jose';

const EXPIRY_SKEW_MS = 30_000;

export interface AccessToken {
  raw: string;
  expiresAt: number;
}

let currentToken: AccessToken | null = null;

// ─── Subscriber system ────────────────────────────────────────────────────────

type TokenSubscriber = (token: string | null) => void;
const subscribers = new Set<TokenSubscriber>();

function notifySubscribers(token: string | null): void {
  for (const callback of subscribers) callback(token);
}

export function subscribeToToken(callback: TokenSubscriber): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

// ─── Token accessors ──────────────────────────────────────────────────────────

export function getAccessToken(): AccessToken | null {
  return currentToken;
}

export function setAccessToken(token: AccessToken | null): void {
  currentToken = token;
  notifySubscribers(token?.raw ?? null);
}

export function clearAccessToken(): void {
  currentToken = null;
  notifySubscribers(null);
}

export function isExpired(token: AccessToken | null): boolean {
  if (token === null) return true;
  return token.expiresAt - EXPIRY_SKEW_MS <= Date.now();
}

export function fromJwt(raw: string): AccessToken {
  const claims = decodeJwt(raw);
  if (typeof claims.exp !== 'number') {
    throw new Error('JWT is missing the exp claim');
  }
  return {
    raw,
    expiresAt: claims.exp * 1000,
  };
}
