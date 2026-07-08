import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('InMemoryRateLimiter', () => {
  beforeEach(async () => {
    vi.resetModules()
  })

  it('allows requests below the limit', async () => {
    const { createInMemoryRateLimiter } = await import('./in-memory.adapter.js')
    const limiter = createInMemoryRateLimiter()

    expect(limiter.check('key1', 5, 60000)).toBe(true)
  })

  it('blocks after limit is reached', async () => {
    const { createInMemoryRateLimiter } = await import('./in-memory.adapter.js')
    const limiter = createInMemoryRateLimiter()
    const key = 'key-block'
    const limit = 3
    const windowMs = 60000

    for (let i = 0; i < limit; i++) {
      limiter.increment(key, windowMs)
    }

    expect(limiter.check(key, limit, windowMs)).toBe(false)
  })

  it('remaining decreases as requests are made', async () => {
    const { createInMemoryRateLimiter } = await import('./in-memory.adapter.js')
    const limiter = createInMemoryRateLimiter()
    const key = 'key-remaining'
    const limit = 5
    const windowMs = 60000

    expect(limiter.remaining(key, limit, windowMs)).toBe(5)
    limiter.increment(key, windowMs)
    expect(limiter.remaining(key, limit, windowMs)).toBe(4)
    limiter.increment(key, windowMs)
    expect(limiter.remaining(key, limit, windowMs)).toBe(3)
  })

  it('remaining never goes below zero', async () => {
    const { createInMemoryRateLimiter } = await import('./in-memory.adapter.js')
    const limiter = createInMemoryRateLimiter()
    const key = 'key-floor'
    const limit = 2
    const windowMs = 60000

    for (let i = 0; i < 10; i++) {
      limiter.increment(key, windowMs)
    }

    expect(limiter.remaining(key, limit, windowMs)).toBe(0)
  })

  it('resets window after windowMs elapses', async () => {
    vi.useFakeTimers()
    const { createInMemoryRateLimiter } = await import('./in-memory.adapter.js')
    const limiter = createInMemoryRateLimiter()
    const key = 'key-reset'
    const limit = 2
    const windowMs = 1000

    limiter.increment(key, windowMs)
    limiter.increment(key, windowMs)
    expect(limiter.check(key, limit, windowMs)).toBe(false)

    vi.advanceTimersByTime(windowMs + 1)
    expect(limiter.check(key, limit, windowMs)).toBe(true)
    vi.useRealTimers()
  })
})
