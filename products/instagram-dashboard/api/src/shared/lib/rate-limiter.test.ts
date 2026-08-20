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
    const limiter = new FixedWindowRateLimiter(1, 50);
    limiter.allows('a');
    limiter.record('a');
    expect(limiter.allows('a')).toBe(false);

    const later = Date.now() + 100;
    vi.spyOn(Date, 'now').mockReturnValue(later);

    expect(limiter.allows('a')).toBe(true);
    vi.restoreAllMocks();
  });

  /**
   * Carried over from the counter this replaced: the call that opens a window
   * is allowed whatever the limit says. Recorded rather than corrected — the
   * production limit is 190, where one extra call is noise.
   */
  it('lets the first call through even at a limit of zero', () => {
    const limiter = new FixedWindowRateLimiter(0, 60_000);

    expect(limiter.allows('a')).toBe(true);
    expect(limiter.allows('a')).toBe(false);
  });
});
