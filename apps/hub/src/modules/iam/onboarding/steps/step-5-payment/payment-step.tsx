'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { type JSX } from 'react';

import { useDraftContext } from '../../context/draft-context';

import { PaymentInitiateView } from './payment-initiate-view';
import { PaymentVerifyingView } from './payment-verifying-view';
import { usePaymentPolling, ATTEMPT_STORAGE_KEY } from './use-payment-polling';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StepPaymentProps {
  draftId: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StepPayment({ draftId }: StepPaymentProps): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { draft, plan } = useDraftContext();

  const statusParam = searchParams.get('status');
  const isVerifying = statusParam === 'verifying';

  const { pollStatus, pollSeconds, resetPolling } = usePaymentPolling(draftId, isVerifying);

  // ─── Retry payment after declined/cancelled ────────────────────────────────

  function handleRetry(): void {
    const storedAttempt = localStorage.getItem(ATTEMPT_STORAGE_KEY(draftId));
    const attempt = storedAttempt !== null ? Number(storedAttempt) + 1 : 1;
    localStorage.setItem(ATTEMPT_STORAGE_KEY(draftId), String(attempt));
    router.replace(`/signup/${draftId}/payment`);
  }

  function handleRetryVerification(): void {
    resetPolling();
  }

  if (isVerifying) {
    return (
      <PaymentVerifyingView
        draftId={draftId}
        pollStatus={pollStatus}
        pollSeconds={pollSeconds}
        onRetry={handleRetry}
        onRetryVerification={handleRetryVerification}
      />
    );
  }

  return <PaymentInitiateView draftId={draftId} plan={plan} draft={draft} />;
}
