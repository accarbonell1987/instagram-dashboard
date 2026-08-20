import { describe, it, expect, vi } from 'vitest';

import { FixedWindowRateLimiter } from './rate-limiter.js';

describe('FixedWindowRateLimiter', () => {
  it('allows up to the limit and refuses after', () => {
    const limiter = new FixedWindowRateLimiter(3, 60_000);

    for (let i = 0; i < 3; i++) {
      expect(limiter.allows('a')).toBe(true);
      limiter.record('a');
    }

    expect(limiter.allows('a')).toBe(false);
  });

  it('counts each key on its own', () => {
    const limiter = new FixedWindowRateLimiter(1, 60_000);
    limiter.allows('a');
    limiter.record('a');

    expect(limiter.allows('a')).toBe(false);
    expect(limiter.allows('b')).toBe(true);
  });

  /** Checking is not spending: a caller may ask and then decide not to go. */
  it('does not consume the allowance just by asking', () => {
    const limiter = new FixedWindowRateLimiter(1, 60_000);

    expect(limiter.allows('a')).toBe(true);
    expect(limiter.allows('a')).toBe(true);
  });

  it('starts over once the window has passed', () => {
    // Fake timers rather than a spy on Date.now: the spy had to be undone
    // globally, and a global undo in one test reaches into every other.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-20T10:00:00Z'));

    const limiter = new FixedWindowRateLimiter(1, 60_000);
    limiter.allows('a');
    limiter.record('a');
    expect(limiter.allows('a')).toBe(false);

    vi.setSystemTime(new Date('2026-08-20T10:02:00Z'));

    expect(limiter.allows('a')).toBe(true);
    vi.useRealTimers();
  });

  /**
   * The version extracted from SyncService let the call that opened a window
   * through whatever the limit said. The middleware's copy did not, and the
   * middleware was right — so the merged one refuses from the first call.
   */
  it('refuses from the first call at a limit of zero', () => {
    const limiter = new FixedWindowRateLimiter(0, 60_000);

    expect(limiter.allows('a')).toBe(false);
  });

  /** For a Retry-After: how long until this key gets its allowance back. */
  it('reports the seconds left in the window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-20T10:00:00Z'));
    const limiter = new FixedWindowRateLimiter(1, 60_000);
    limiter.allows('a');

    vi.setSystemTime(new Date('2026-08-20T10:00:20Z'));

    expect(limiter.retryAfterSeconds('a')).toBe(40);
    vi.useRealTimers();
  });
});
