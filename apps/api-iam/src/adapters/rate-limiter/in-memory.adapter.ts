import type { RateLimiter } from './types.js'

interface WindowEntry {
  count: number
  resetAt: number
}

class InMemoryRateLimiter implements RateLimiter {
  private readonly store = new Map<string, WindowEntry>()

  private getOrCreate(key: string, windowMs: number): WindowEntry {
    const now = Date.now()
    const existing = this.store.get(key)
    if (!existing || existing.resetAt <= now) {
      const entry: WindowEntry = { count: 0, resetAt: now + windowMs }
      this.store.set(key, entry)
      return entry
    }
    return existing
  }

  check(key: string, limit: number, windowMs: number): boolean {
    const entry = this.getOrCreate(key, windowMs)
    return entry.count < limit
  }

  increment(key: string, windowMs: number): void {
    const entry = this.getOrCreate(key, windowMs)
    entry.count++
  }

  remaining(key: string, limit: number, windowMs: number): number {
    const entry = this.getOrCreate(key, windowMs)
    return Math.max(0, limit - entry.count)
  }
}

let instance: RateLimiter | undefined

export function createInMemoryRateLimiter(): RateLimiter {
  if (!instance) {
    instance = new InMemoryRateLimiter()
  }
  return instance
}
