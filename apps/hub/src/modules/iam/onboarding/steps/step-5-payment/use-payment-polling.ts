'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

import { getPaymentStatus } from '../../services/draft.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 2_000;
const POLL_MAX_SECONDS = 60;
export const ATTEMPT_STORAGE_KEY = (draftId: string) => `draft:${draftId}:payment:attempt`;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UsePaymentPollingResult {
  pollStatus: 'pending' | 'approved' | 'declined' | 'timeout' | null;
  pollSeconds: number;
  resetPolling: () => void;
}

export function usePaymentPolling(draftId: string, isVerifying: boolean): UsePaymentPollingResult {
  const router = useRouter();
  const [pollSeconds, setPollSeconds] = useState(0);
  const [pollStatus, setPollStatus] = useState<
    'pending' | 'approved' | 'declined' | 'timeout' | null
  >(null);

  // Bug 6 fix: ref so pollPaymentStatus can clear the interval immediately on approval
  // without needing a stale closure over the interval ID.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedRef = useRef(false);

  const pollPaymentStatus = useCallback(async (): Promise<void> => {
    try {
      const result = await getPaymentStatus(draftId);
      setPollStatus(result.status);

      if (result.status === 'approved') {
        // Stop the interval immediately so no further polls run after navigation
        stoppedRef.current = true;
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        router.push(`/signup/${draftId}/summary`);
      }
    } catch {
      // Network error during polling — continue polling
    }
  }, [draftId, router]);

  useEffect(() => {
    if (!isVerifying) return;

    stoppedRef.current = false;
    let elapsed = 0;

    const interval = setInterval(() => {
      if (stoppedRef.current) return;

      elapsed += POLL_INTERVAL_MS / 1000;
      setPollSeconds(elapsed);

      if (elapsed >= POLL_MAX_SECONDS) {
        clearInterval(interval);
        intervalRef.current = null;
        setPollStatus('timeout');
        return;
      }

      void pollPaymentStatus();
    }, POLL_INTERVAL_MS);

    intervalRef.current = interval;

    // Immediately check on mount
    void pollPaymentStatus();

    return () => {
      clearInterval(interval);
      intervalRef.current = null;
    };
  }, [isVerifying, pollPaymentStatus]);

  function resetPolling(): void {
    stoppedRef.current = false;
    setPollStatus(null);
    setPollSeconds(0);
    void pollPaymentStatus();
  }

  return { pollStatus, pollSeconds, resetPolling };
}
