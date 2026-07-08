'use client';

import { Button, Checkbox, InputOTP, InputOTPGroup, InputOTPSlot, Label } from '@core/ui';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useState, type JSX } from 'react';

import { useCountdown } from '../hooks/use-countdown';

export interface OtpFormProps {
  otpId: string;
  channel: 'email' | 'sms';
  identifier: string;
  onVerify: (code: string, trustDevice: boolean) => Promise<void>;
  onResend: () => Promise<void>;
  onBack?: () => void;
  showTrustDevice?: boolean;
  autoVerify?: boolean;
  cooldownSeconds?: number;
  maxAttempts?: number;
}

const OTP_LENGTH = 6;
const DEFAULT_MAX_ATTEMPTS = 5;

type VerificationStatus = 'idle' | 'verifying' | 'success' | 'error';

export function OtpForm({
  channel,
  identifier,
  onVerify,
  onResend,
  onBack,
  showTrustDevice = false,
  autoVerify = false,
  cooldownSeconds = 30,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
}: OtpFormProps): JSX.Element {
  const [code, setCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('idle');
  const [attemptsLeft, setAttemptsLeft] = useState(maxAttempts);
  const [isLocked, setIsLocked] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const isVerifying = verificationStatus === 'verifying';
  const countdown = useCountdown(cooldownSeconds, { autoStart: true });

  const channelLabel = channel === 'email' ? 'correo electrónico' : 'SMS';

  async function handleVerifyWithCode(codeToVerify: string): Promise<void> {
    if (codeToVerify.length !== OTP_LENGTH || isLocked) return;

    setVerificationStatus('verifying');
    setError(null);

    try {
      await onVerify(codeToVerify, trustDevice);
      setVerificationStatus('success');
    } catch (err: unknown) {
      setVerificationStatus('error');
      const newAttemptsLeft = attemptsLeft - 1;
      setAttemptsLeft(newAttemptsLeft);

      if (newAttemptsLeft <= 0) {
        setIsLocked(true);
        setError('Demasiados intentos. Esperá 15 minutos antes de intentar de nuevo.');
      } else {
        const message =
          err instanceof Error && err.message.length > 0
            ? err.message
            : 'Código incorrecto. Verificá el código e intentá de nuevo.';

        const remainingMessage =
          newAttemptsLeft <= 2
            ? ` Te quedan ${String(newAttemptsLeft)} intento${newAttemptsLeft === 1 ? '' : 's'}.`
            : '';

        setError(`${message}${remainingMessage}`);
      }
    }
  }

  function handleCodeChange(newCode: string): void {
    // Reset error state when user edits after a failed attempt
    const wasError = verificationStatus === 'error';
    if (wasError) {
      setVerificationStatus('idle');
      setError(null);
    }

    setCode(newCode);

    // Auto-verify on completion (only on fresh entry, not recovery from error)
    if (autoVerify && newCode.length === OTP_LENGTH && !wasError) {
      void handleVerifyWithCode(newCode);
    }
  }

  async function handleResend(): Promise<void> {
    setIsResending(true);
    setError(null);
    setVerificationStatus('idle');
    setCode('');
    try {
      await onResend();
      countdown.reset(cooldownSeconds);
    } catch {
      setError('No se pudo reenviar el código. Intentá de nuevo.');
    } finally {
      setIsResending(false);
    }
  }

  const resendLabel = countdown.isActive
    ? `Reenviar código en 0:${String(countdown.seconds).padStart(2, '0')}`
    : 'Reenviar código';

  const inputGroupClass =
    verificationStatus === 'success'
      ? '[&_[data-slot=input-otp-slot]]:border-green-500 [&_[data-slot=input-otp-slot]]:text-green-700 dark:[&_[data-slot=input-otp-slot]]:text-green-400'
      : verificationStatus === 'error'
        ? '[&_[data-slot=input-otp-slot]]:border-destructive'
        : '';

  return (
    <div className="flex flex-col gap-6">
      {/* Destination info */}
      <p className="text-muted-foreground text-sm">
        Enviamos un código de 6 dígitos a tu {channelLabel}{' '}
        <span className="font-medium">{identifier}</span>.
      </p>

      {/* Error alert */}
      {error !== null && (
        <div
          role="alert"
          aria-live="assertive"
          className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm"
        >
          {error}
        </div>
      )}

      {/* OTP input */}
      <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
        <Label htmlFor="otp-input">Código de verificación</Label>
        <div className={`flex items-center gap-3 ${inputGroupClass}`}>
          <InputOTP
            id="otp-input"
            maxLength={OTP_LENGTH}
            value={code}
            onChange={handleCodeChange}
            disabled={isLocked || isVerifying || verificationStatus === 'success'}
            aria-label="Código de verificación de 6 dígitos"
            aria-describedby={error !== null ? 'otp-error' : undefined}
          >
            <InputOTPGroup>
              {Array.from({ length: OTP_LENGTH }).map((_, index) => (
                <InputOTPSlot
                  key={index}
                  index={index}
                  aria-label={`Dígito ${String(index + 1)} de 6`}
                />
              ))}
            </InputOTPGroup>
          </InputOTP>

          <div className="flex h-9 w-6 items-center justify-center">
            {verificationStatus === 'verifying' && (
              <div
                className="border-primary h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
                aria-label="Verificando..."
              />
            )}
            {verificationStatus === 'success' && (
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-500" aria-label="Código verificado" />
            )}
            {verificationStatus === 'error' && (
              <XCircle className="text-destructive h-5 w-5 flex-shrink-0" aria-label="Código incorrecto" />
            )}
          </div>
        </div>
      </div>

      {showTrustDevice && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="trust-device"
            checked={trustDevice}
            onCheckedChange={(checked) => {
              setTrustDevice(checked === true);
            }}
            disabled={isLocked}
          />
          <Label htmlFor="trust-device" className="cursor-pointer text-sm">
            Confiar en este dispositivo por 60 días
          </Label>
        </div>
      )}

      {/* Submit — hidden in autoVerify mode */}
      {!autoVerify && (
        <Button
          type="button"
          onClick={() => void handleVerifyWithCode(code)}
          disabled={code.length !== OTP_LENGTH || isLocked || isVerifying || verificationStatus === 'success'}
          aria-busy={isVerifying}
          className="mx-auto w-full max-w-sm"
        >
          {isVerifying ? 'Verificando...' : verificationStatus === 'success' ? 'Verificado' : 'Verificar código'}
        </Button>
      )}

      {/* Resend */}
      {onBack !== undefined ? (
        <div className="flex items-center justify-between text-sm">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void handleResend()}
            disabled={countdown.isActive || isResending || isLocked}
            aria-disabled={countdown.isActive}
            aria-label={resendLabel}
          >
            {isResending ? 'Reenviando...' : resendLabel}
          </Button>
          <Button type="button" variant="link" size="sm" onClick={onBack}>
            Volver
          </Button>
        </div>
      ) : (
        <div className="pt-4 text-center">
          {isResending ? (
            <span className="text-muted-foreground text-sm">Reenviando...</span>
          ) : countdown.isActive || isLocked ? (
            <span className="text-muted-foreground text-sm">{resendLabel}</span>
          ) : (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => void handleResend()}
              className="text-sm font-medium"
            >
              {resendLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
