import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { generateIdempotencyKey, getIdempotencyKey, resetIdempotencyKey } from './idempotency';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('generateIdempotencyKey', () => {
  it('generates a UUID v4', () => {
    const key = generateIdempotencyKey();
    expect(key).toMatch(UUID_REGEX);
  });

  it('generates unique keys on each call', () => {
    const a = generateIdempotencyKey();
    const b = generateIdempotencyKey();
    expect(a).not.toBe(b);
  });
});

describe('getIdempotencyKey', () => {
  const storageMock: Record<string, string> = {};

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storageMock[key] ?? null,
      setItem: (key: string, value: string) => { storageMock[key] = value; },
      removeItem: (key: string) => { Reflect.deleteProperty(storageMock, key); },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.keys(storageMock).forEach(k => { Reflect.deleteProperty(storageMock, k); });
  });

  it('generates and stores a key for a new scope', () => {
    const key = getIdempotencyKey('draft:abc:step:1');
    expect(key).toMatch(UUID_REGEX);
    expect(storageMock['idempotency:draft:abc:step:1']).toBe(key);
  });

  it('returns the same key on subsequent calls for the same scope', () => {
    const key1 = getIdempotencyKey('draft:abc:step:1');
    const key2 = getIdempotencyKey('draft:abc:step:1');
    expect(key1).toBe(key2);
  });

  it('returns different keys for different scopes', () => {
    const key1 = getIdempotencyKey('draft:abc:step:1');
    const key2 = getIdempotencyKey('draft:abc:payment:v1');
    expect(key1).not.toBe(key2);
  });
});

describe('resetIdempotencyKey', () => {
  const storageMock: Record<string, string> = {};

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storageMock[key] ?? null,
      setItem: (key: string, value: string) => { storageMock[key] = value; },
      removeItem: (key: string) => { Reflect.deleteProperty(storageMock, key); },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.keys(storageMock).forEach(k => { Reflect.deleteProperty(storageMock, k); });
  });

  it('discards the stored key so the next get returns a new one', () => {
    const storageMockFixed: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storageMockFixed[key] ?? null,
      setItem: (key: string, value: string) => { storageMockFixed[key] = value; },
      removeItem: (key: string) => { Reflect.deleteProperty(storageMockFixed, key); },
    });

    const scope = 'draft:xyz:submit';
    const key1 = getIdempotencyKey(scope);
    resetIdempotencyKey(scope);
    const key2 = getIdempotencyKey(scope);
    expect(key2).not.toBe(key1);
    expect(key2).toMatch(UUID_REGEX);
  });
});
