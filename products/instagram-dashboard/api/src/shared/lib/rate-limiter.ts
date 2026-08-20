/**
 * A fixed window of calls per key, counted in memory.
 *
 * Lived inside `SyncService` as a Map and two private methods — a second
 * responsibility in the service that synchronises, and one nothing else could
 * reuse. Nothing about counting calls is specific to syncing.
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
    const counter = this.counters.get(key);
    if (counter === undefined || Date.now() - counter.windowStart > this.windowMs) {
      this.counters.set(key, { count: 0, windowStart: Date.now() });
      return true;
    }
    return counter.count < this.max;
  }

  /** Spend one. Separate from `allows` because the caller may check and then bail. */
  record(key: string): void {
    const counter = this.counters.get(key);
    if (counter !== undefined) counter.count++;
  }
}
