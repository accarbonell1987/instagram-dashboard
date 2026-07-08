'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseCountdownOptions {
  autoStart?: boolean;
}

export interface UseCountdownResult {
  seconds: number;
  isActive: boolean;
  start: () => void;
  reset: (newSeconds?: number) => void;
}

export function useCountdown(
  initialSeconds: number,
  options: UseCountdownOptions = {}
): UseCountdownResult {
  const { autoStart = true } = options;

  const [seconds, setSeconds] = useState(autoStart ? initialSeconds : 0);
  const [isActive, setIsActive] = useState(autoStart && initialSeconds > 0);
  const initialRef = useRef(initialSeconds);

  useEffect(() => {
    if (!isActive) return;

    const intervalId = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId);
          setIsActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isActive]);

  const start = useCallback(() => {
    setSeconds(initialRef.current);
    setIsActive(true);
  }, []);

  const reset = useCallback((newSeconds?: number) => {
    const target = newSeconds ?? initialRef.current;
    if (newSeconds !== undefined) {
      initialRef.current = newSeconds;
    }
    setSeconds(target);
    setIsActive(target > 0);
  }, []);

  return { seconds, isActive, start, reset };
}
