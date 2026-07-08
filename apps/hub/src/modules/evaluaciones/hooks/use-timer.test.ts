import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useTimer } from './use-timer'

describe('useTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('formats time correctly: 5:00 → "05:00"', () => {
    const { result } = renderHook(() => useTimer(5))

    expect(result.current.formatted).toBe('05:00')
    expect(result.current.minutes).toBe(5)
    expect(result.current.seconds).toBe(0)
  })

  it('pads single-digit minutes and seconds with leading zero', () => {
    const { result } = renderHook(() => useTimer(9))

    expect(result.current.formatted).toBe('09:00')

    act(() => {
      vi.advanceTimersByTime(8 * 60 * 1000 + 59 * 1000)
    })

    // After 8m 59s elapsed from 9:00 → 0:01
    expect(result.current.formatted).toBe('00:01')
  })

  it('returns isExpired when time reaches 0', () => {
    const { result } = renderHook(() => useTimer(0))

    // Timer started with 0 minutes → immediate expiration
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current.isExpired).toBe(true)
    expect(result.current.remaining).toBeUndefined
  })

  it('counts down over time', () => {
    const { result } = renderHook(() => useTimer(5))

    expect(result.current.formatted).toBe('05:00')

    // Advance 1 second
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current.formatted).toBe('04:59')
    expect(result.current.minutes).toBe(4)
    expect(result.current.seconds).toBe(59)

    // Advance 2 more minutes
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000)
    })

    expect(result.current.formatted).toBe('02:59')
    expect(result.current.minutes).toBe(2)
    expect(result.current.seconds).toBe(59)

    // Advance to nearly expired
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000 + 59 * 1000)
    })

    expect(result.current.formatted).toBe('00:00')
    expect(result.current.isExpired).toBe(true)
  })

  it('activates isWarning when less than 1 minute remains', () => {
    const { result } = renderHook(() => useTimer(2))

    // Initially at 2:00 — should NOT warn
    expect(result.current.isWarning).toBe(false)

    // Advance to 1:01 — still not warning
    act(() => {
      vi.advanceTimersByTime(59 * 1000)
    })

    expect(result.current.formatted).toBe('01:01')
    expect(result.current.isWarning).toBe(false)

    // Advance to 0:59 — should warn
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(result.current.formatted).toBe('00:59')
    expect(result.current.isWarning).toBe(true)

    // Advance to 0:00 — should no longer warn (isExpired instead)
    act(() => {
      vi.advanceTimersByTime(59 * 1000)
    })

    expect(result.current.isExpired).toBe(true)
    expect(result.current.isWarning).toBe(false)
  })

  it('warns at exactly 1:00 (remaining ≤ 60)', () => {
    const { result } = renderHook(() => useTimer(2))

    // Advance to 1:00
    act(() => {
      vi.advanceTimersByTime(60 * 1000)
    })

    expect(result.current.formatted).toBe('01:00')
    // Warning is active because remaining <= 60
    expect(result.current.isWarning).toBe(true)
    expect(result.current.isExpired).toBe(false)
  })

  it('stops the interval when expired', () => {
    const { result, unmount } = renderHook(() => useTimer(1))

    // Fast-forward past expiry
    act(() => {
      vi.advanceTimersByTime(61 * 1000)
    })

    expect(result.current.isExpired).toBe(true)
    expect(result.current.formatted).toBe('00:00')

    // May remain at 00:00, not go negative
    expect(result.current.minutes).toBe(0)
    expect(result.current.seconds).toBe(0)

    unmount()
  })
})
