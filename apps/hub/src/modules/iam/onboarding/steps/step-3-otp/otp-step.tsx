'use client';

import { Mail } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type JSX } from 'react';

import { StepHeader } from '../../components/step-header';
import { WizardNav } from '../../components/wizard-nav';
import { useDraftContext } from '../../context/draft-context';
import { patchDraft } from '../../services/draft.service';

import { OtpForm } from '@/modules/iam/authentication/components/otp-form';
import { verifyOtp, sendOtp } from '@/modules/iam/authentication/services/auth.service';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StepOtpVerificationProps {
  draftId: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StepOtpVerification({ draftId }: StepOtpVerificationProps): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { draft, refresh } = useDraftContext();

  const [otpId, setOtpId] = useState<string>(() => searchParams.get('otpId') ?? '');
  const [isVerified, setIsVerified] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const sendAttempted = useRef(false);

  const email = draft.representative?.email ?? '';

  async function handleInitialSend(): Promise<void> {
    try {
      const result = await sendOtp({
        channel: 'email',
        purpose: 'signup-rep',
        identifier: email,
      });
      setOtpId(result.otpId);
    } catch {
      setOtpId('pending-resend');
    }
  }

  // Only send OTP on mount if we didn't receive one from the URL.
  // Normal flow: representative step passes ?otpId=... → no re-send needed.
  // Edge case: user navigates directly to this URL → send a fresh OTP.
  // sendAttempted ref prevents React Strict Mode double-fire (refs survive remount).
  useEffect(() => {
    if (email.length === 0) return;
    if (otpId.length > 0) return;
    if (sendAttempted.current) return;
    sendAttempted.current = true;
    void handleInitialSend();
  }, [email]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleVerify(code: string): Promise<void> {
    const result = await verifyOtp({ otpId, code });
    setIsVerified(true);
    void result;
  }

  async function handleContinue(): Promise<void> {
    setIsContinuing(true);
    try {
      await patchDraft(draftId, 'otp', { version: draft.version });
      refresh();
      router.push(`/signup/${draftId}/company`);
    } finally {
      setIsContinuing(false);
    }
  }

  async function handleResend(): Promise<void> {
    setIsVerified(false);
    const result = await sendOtp({
      channel: 'email',
      purpose: 'signup-rep',
      identifier: email,
    });
    setOtpId(result.otpId);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8">
      <StepHeader
        icon={Mail}
        title="Verificación del correo"
        description={
          <p className="text-muted-foreground mt-2">
            Ingresa el código de 6 dígitos que enviamos a tu correo.
          </p>
        }
      />

      {otpId.length > 0 && (
        <>
          <OtpForm
            otpId={otpId}
            channel="email"
            identifier={email}
            onVerify={handleVerify}
            onResend={handleResend}
            showTrustDevice={false}
          />

          <WizardNav
            currentStep="otp"
            draftId={draftId}
            onContinue={isVerified ? handleContinue : undefined}
            isSubmitting={isContinuing}
          />
        </>
      )}

      {otpId.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <div
            className="border-primary h-6 w-6 animate-spin rounded-full border-4 border-t-transparent"
            role="status"
            aria-label="Enviando código..."
          />
        </div>
      )}
    </div>
  );
}
