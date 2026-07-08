'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseTimerResult {
  minutes: number
  seconds: number
  isExpired: boolean
  isWarning: boolean
  formatted: string
}

/**
 * Countdown timer for quiz taking.
 * Returns minutes/seconds and state. Purely visual — no auto-submit.
 * Warning state activates when less than 1 minute remains.
 */
export function useTimer(totalMinutes: number): UseTimerResult {
  const totalSeconds = totalMinutes * 60
  const [remaining, setRemaining] = useState(totalSeconds)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isExpired = remaining <= 0
  const isWarning = remaining <= 60 && remaining > 0

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  const tick = useCallback(() => {
    setRemaining((prev) => {
      if (prev <= 1) {
        return 0
      }
      return prev - 1
    })
  }, [])

  useEffect(() => {
    intervalRef.current = setInterval(tick, 1000)

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
      }
    }
  }, [tick])

  // Stop the interval when expired
  useEffect(() => {
    if (remaining <= 0 && intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [remaining])

  return { minutes, seconds, isExpired, isWarning, formatted }
}
