import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as HubToken from './hub-token';

// Fresh module state per test — the token holder is module-level.
let mod: typeof HubToken;
let cleanup: (() => void) | undefined;

beforeEach(async () => {
  vi.resetModules();
  mod = await import('./hub-token');
  cleanup = mod.initHubToken();
});

afterEach(() => {
  cleanup?.();
});

function postFromHub(data: unknown, origin = window.location.origin): void {
  window.dispatchEvent(new MessageEvent('message', { data, origin }));
}

describe('hub-token postMessage consumer', () => {
  it('returns null before any token arrives', () => {
    expect(mod.getHubToken()).toBeNull();
  });

  it('stores the token from a corehub.hub.v1.token message', () => {
    postFromHub({ type: 'corehub.hub.v1.token', token: 'jwt-abc' });
    expect(mod.getHubToken()).toBe('jwt-abc');
  });

  it('clears the token on corehub.hub.v1.signOut', () => {
    postFromHub({ type: 'corehub.hub.v1.token', token: 'jwt-abc' });
    expect(mod.getHubToken()).toBe('jwt-abc');

    postFromHub({ type: 'corehub.hub.v1.signOut' });
    expect(mod.getHubToken()).toBeNull();
  });

  it('ignores messages from an untrusted origin', () => {
    postFromHub({ type: 'corehub.hub.v1.token', token: 'jwt-evil' }, 'https://evil.example.com');
    expect(mod.getHubToken()).toBeNull();
  });
});
