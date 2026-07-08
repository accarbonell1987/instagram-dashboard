import { afterEach, describe, expect, it } from 'vitest';

import {
  clearAccessToken,
  fromJwt,
  getAccessToken,
  isExpired,
  setAccessToken,
} from './token';

function makeJwt(expSeconds: number | undefined): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '');
  const payload = btoa(
    JSON.stringify(expSeconds !== undefined ? { exp: expSeconds } : {})
  ).replace(/=/g, '');
  return `${header}.${payload}.fakesignature`;
}

afterEach(() => {
  clearAccessToken();
});

describe('setAccessToken / getAccessToken', () => {
  it('stores and retrieves a token', () => {
    const token = { raw: 'test.jwt.token', expiresAt: Date.now() + 60_000 };
    setAccessToken(token);
    expect(getAccessToken()).toEqual(token);
  });

  it('returns null before any token is set', () => {
    expect(getAccessToken()).toBeNull();
  });
});

describe('clearAccessToken', () => {
  it('clears a previously set token', () => {
    setAccessToken({ raw: 'test.jwt.token', expiresAt: Date.now() + 60_000 });
    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });
});

describe('isExpired', () => {
  it('returns true for null', () => {
    expect(isExpired(null)).toBe(true);
  });

  it('returns false for a token expiring in the future (beyond 30s skew)', () => {
    const token = { raw: 'x', expiresAt: Date.now() + 60_000 };
    expect(isExpired(token)).toBe(false);
  });

  it('returns true for an already-expired token', () => {
    const token = { raw: 'x', expiresAt: Date.now() - 1_000 };
    expect(isExpired(token)).toBe(true);
  });

  it('returns true 30 seconds before expiry (30s skew)', () => {
    const token = { raw: 'x', expiresAt: Date.now() + 20_000 };
    expect(isExpired(token)).toBe(true);
  });

  it('returns false 31 seconds before expiry', () => {
    const token = { raw: 'x', expiresAt: Date.now() + 31_000 };
    expect(isExpired(token)).toBe(false);
  });
});

describe('fromJwt', () => {
  it('parses exp claim and builds AccessToken', () => {
    const expMs = Date.now() + 300_000;
    const expSeconds = Math.floor(expMs / 1000);
    const raw = makeJwt(expSeconds);
    const token = fromJwt(raw);
    expect(token.raw).toBe(raw);
    expect(Math.abs(token.expiresAt - expSeconds * 1000)).toBeLessThan(1001);
  });

  it('throws on a malformed JWT', () => {
    expect(() => fromJwt('not.a.jwt')).toThrow();
  });

  it('throws when exp claim is missing', () => {
    const raw = makeJwt(undefined);
    expect(() => fromJwt(raw)).toThrow();
  });
});
