/**
 * A fixed window of calls per key, counted in memory.
 *
 * There were two of these. `SyncService` kept a Map and two private methods,
 * and `middleware/rate-limiter.ts` kept the same Map with the same 190 calls
 * per hour — the same rule written twice, for the same API's limit, either one
 * free to drift from the other.
 *
 * In memory on purpose: one process, and a counter that resets on restart is
 * the right failure mode for a courtesy limit. A shared limit across instances
 * would need a store, and that is a different decision to make deliberately.
 */
export class FixedWindowRateLimiter {
  private readonly counters = new Map<string, { count: number; windowStart: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Whether `key` has room left in its current window. Does not consume it. */
  allows(key: string): boolean {
    return this.window(key).count < this.max;
  }

  /** Seconds until the current window rolls over, for a Retry-After header. */
  retryAfterSeconds(key: string): number {
    const counter = this.window(key);
    return Math.ceil((counter.windowStart + this.windowMs - Date.now()) / 1000);
  }

  /** The live window for a key, opening a fresh one when the last has expired. */
  private window(key: string): { count: number; windowStart: number } {
    const counter = this.counters.get(key);
    if (counter !== undefined && Date.now() - counter.windowStart <= this.windowMs) {
      return counter;
    }
    const fresh = { count: 0, windowStart: Date.now() };
    this.counters.set(key, fresh);
    return fresh;
  }

  /** Spend one. Separate from `allows` because the caller may check and then bail. */
  record(key: string): void {
    const counter = this.counters.get(key);
    if (counter !== undefined) counter.count++;
  }
}
