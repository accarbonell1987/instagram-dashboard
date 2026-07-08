/**
 * Deterministic helpers for MSW mock data.
 * Never use Date.now() or Math.random() in handlers — use these instead.
 */

const FIXED_NOW_MS = 1_746_000_000_000; // 2025-04-30T00:00:00Z — stable baseline

/** Stable "now" as ISO string. */
export function stableNow(): string {
  return new Date(FIXED_NOW_MS).toISOString();
}

/** Stable future date, `offsetSeconds` ahead of fixed now. */
export function stableFuture(offsetSeconds: number): string {
  return new Date(FIXED_NOW_MS + offsetSeconds * 1000).toISOString();
}

/** Stable past date. */
export function stablePast(offsetSeconds: number): string {
  return new Date(FIXED_NOW_MS - offsetSeconds * 1000).toISOString();
}

/**
 * Hand-craft a base64url-encoded fake JWT. NOT signed — browser-side decode only.
 * Payload is merged with default claims.
 */
export function mintFakeJwt(payload: Record<string, unknown>): string {
  const header = { alg: 'none', typ: 'JWT' };
  const claims = {
    iat: Math.floor(FIXED_NOW_MS / 1000),
    exp: Math.floor(FIXED_NOW_MS / 1000) + 900,
    jti: 'mock-jti',
    ...payload,
  };
  const encode = (obj: unknown): string =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode(header)}.${encode(claims)}.MOCK_SIG`;
}

/**
 * Simple counter-based ID generator — deterministic per reset.
 * Resets when `resetIdCounter()` is called (typically in `resetDb()`).
 */
let counter = 1;

export function generateId(prefix = ''): string {
  const id = String(counter++).padStart(4, '0');
  return prefix ? `${prefix}-${id}` : id;
}

export function resetIdCounter(): void {
  counter = 1;
}
