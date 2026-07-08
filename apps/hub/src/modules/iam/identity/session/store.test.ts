import { afterEach, describe, expect, it, vi } from 'vitest';

import { getSessionState, setSessionState, subscribe } from './store';

afterEach(() => {
  // Reset to unauthenticated after each test
  setSessionState({ status: 'unauthenticated', session: null });
});

describe('store — getSessionState', () => {
  it('returns unauthenticated by default', () => {
    expect(getSessionState().status).toBe('unauthenticated');
    expect(getSessionState().session).toBeNull();
  });

  it('returns the latest state after setSessionState', () => {
    const user = { id: 'u1', email: 'a@a.com', fullName: 'Alice' };
    const tenant = { id: 't1', slug: 'acme' };
    setSessionState({
      status: 'authenticated',
      session: { user, tenant, role: 'User', accessToken: 'tok', expiresAt: Date.now() + 60_000 },
    });
    const s = getSessionState();
    expect(s.status).toBe('authenticated');
    expect(s.session?.user.email).toBe('a@a.com');
  });
});

describe('store — setSessionState notifies subscribers', () => {
  it('calls subscriber when state changes', () => {
    const listener = vi.fn();
    subscribe(listener);
    setSessionState({ status: 'refreshing', session: null });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ status: 'refreshing', session: null });
  });

  it('notifies multiple subscribers', () => {
    const l1 = vi.fn();
    const l2 = vi.fn();
    subscribe(l1);
    subscribe(l2);
    setSessionState({ status: 'refreshing', session: null });
    expect(l1).toHaveBeenCalledTimes(1);
    expect(l2).toHaveBeenCalledTimes(1);
  });
});

describe('store — subscribe returns unsubscribe', () => {
  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    unsubscribe();
    setSessionState({ status: 'refreshing', session: null });
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not affect other subscribers after unsubscribe', () => {
    const l1 = vi.fn();
    const l2 = vi.fn();
    const unsub1 = subscribe(l1);
    subscribe(l2);
    unsub1();
    setSessionState({ status: 'refreshing', session: null });
    expect(l1).not.toHaveBeenCalled();
    expect(l2).toHaveBeenCalledTimes(1);
  });
});
