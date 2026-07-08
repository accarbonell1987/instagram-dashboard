import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startSessionBroadcast } from './broadcast';
import { getSessionState, setSessionState } from './store';
import { getAccessToken, setAccessToken } from './token';

// ─── BroadcastChannel mock ──────────────────────────────

class MockBroadcastChannel {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  static instances: MockBroadcastChannel[] = [];
  postedMessages: unknown[] = [];

  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.instances.push(this);
  }

  postMessage(data: unknown): void {
    this.postedMessages.push(data);
    // Deliver to all OTHER instances of the same channel
    for (const ch of MockBroadcastChannel.instances) {
      if (ch !== this && ch.name === this.name && ch.onmessage) {
        ch.onmessage(new MessageEvent('message', { data }));
      }
    }
  }

  close(): void {
    MockBroadcastChannel.instances = MockBroadcastChannel.instances.filter((c) => c !== this);
  }
}

beforeEach(() => {
  MockBroadcastChannel.instances = [];
  setSessionState({ status: 'unauthenticated', session: null });
  vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
  vi.stubGlobal('window', global);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('startSessionBroadcast — SSR safety', () => {
  it('returns a no-op stop when window is undefined', () => {
    vi.stubGlobal('window', undefined);
    const stop = startSessionBroadcast();
    expect(typeof stop).toBe('function');
    expect(() => { stop(); }).not.toThrow();
  });
});

describe('startSessionBroadcast — sign-out propagation', () => {
  it('clears token + state in tab B when tab A broadcasts sign-out', () => {
    // Tab B subscribes
    const stopB = startSessionBroadcast();

    // Give tab B a token + authenticated session
    setAccessToken({ raw: 'tok', expiresAt: Date.now() + 60_000 });
    setSessionState({
      status: 'authenticated',
      session: {
        user: { id: 'u1', email: 'a@a.com', fullName: 'Alice' },
        tenant: { id: 't1', slug: 'acme' },
        role: 'User',
        accessToken: 'tok',
        expiresAt: Date.now() + 60_000,
      },
    });

    // Tab A delivers a sign-out message directly to tab B's channel
    const channelB = MockBroadcastChannel.instances[0];
    expect(channelB).toBeDefined();
    channelB?.onmessage?.(new MessageEvent('message', { data: { type: 'sign-out' } }));

    expect(getAccessToken()).toBeNull();
    expect(getSessionState().status).toBe('unauthenticated');

    stopB();
  });

  it('stop() closes the channel and unsubscribes', () => {
    const stop = startSessionBroadcast();
    expect(MockBroadcastChannel.instances).toHaveLength(1);
    stop();
    expect(MockBroadcastChannel.instances).toHaveLength(0);
  });
});

describe('startSessionBroadcast — outgoing broadcast', () => {
  it('posts sign-out message when state becomes unauthenticated', () => {
    startSessionBroadcast();
    const channel = MockBroadcastChannel.instances[0];
    expect(channel).toBeDefined();

    setSessionState({ status: 'unauthenticated', session: null });

    const messages = channel?.postedMessages ?? [];
    const signOuts = messages.filter((m) => (m as { type: string }).type === 'sign-out');
    expect(signOuts.length).toBeGreaterThan(0);
  });
});
