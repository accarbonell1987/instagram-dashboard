'use client';

import { Button, Input, Label } from '@core/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState, type JSX } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { verifyOtp, recoverComplete, sendOtp } from '../services/auth.service';

import { OtpForm } from './otp-form';
import { SetPasswordForm } from './set-password-form';

import { RateLimitError } from '@/lib/api/errors';

type Step = 'email' | 'otp' | 'set-password';

const emailSchema = z.object({
  email: z.string().email('Ingresá un correo electrónico válido'),
});

type EmailFormData = z.infer<typeof emailSchema>;

interface RecoverFormProps {
  tenantSlug: string;
}

export function RecoverForm({ tenantSlug: _tenantSlug }: RecoverFormProps): JSX.Element {
  const router = useRouter();

  const [step, setStep] = useState<Step>('email');
  const [otpId, setOtpId] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [email, setEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  async function handleEmailSubmit(data: EmailFormData): Promise<void> {
    setIsSubmitting(true);
    setGlobalError(null);

    try {
      // OTP puro — no recoverRequest. sendOtp con purpose='recover' es el único paso.
      const result = await sendOtp({
        channel: 'email',
        purpose: 'recover',
        identifier: data.email,
      });
      setEmail(data.email);
      setOtpId(result.otpId);
      // Anti-enumeration: always show the same confirmation message on success
      setSuccessMessage(
        `Si el correo ${data.email} está registrado, recibirás un código de verificación en los próximos minutos.`
      );
      setStep('otp');
    } catch (err: unknown) {
      if (err instanceof RateLimitError) {
        // 429 — show visible feedback, do NOT transition to OTP step
        const seconds = err.retryAfterSeconds;
        const minutes = Math.ceil(seconds / 60);
        setGlobalError(
          `Demasiados intentos. Podés intentar de nuevo en ${String(minutes)} minuto${minutes === 1 ? '' : 's'}.`
        );
      } else {
        // Any other error (including 404 — email not found): anti-enumeration.
        // Silently transition to OTP step with empty otpId. The OTP won't arrive,
        // but the user sees the same confirmation message — no email existence leak.
        setEmail(data.email);
        setOtpId('');
        setSuccessMessage(
          `Si el correo ${data.email} está registrado, recibirás un código de verificación en los próximos minutos.`
        );
        setStep('otp');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOtpVerify(code: string, _trustDevice: boolean): Promise<void> {
    const result = await verifyOtp({ otpId, code });
    setVerificationToken(result.verificationToken);
    setSuccessMessage(null);
    setStep('set-password');
  }

  async function handleOtpResend(): Promise<void> {
    try {
      const result = await sendOtp({ channel: 'email', purpose: 'recover', identifier: email });
      setOtpId(result.otpId);
    } catch {
      // Silently ignore resend errors — OtpForm's cooldown prevents spam
    }
  }

  async function handleSetPassword(password: string): Promise<void> {
    await recoverComplete({ otpVerificationToken: verificationToken, password });
    router.push('/login?recovered=true');
  }

  if (step === 'set-password') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">Ingresá tu nueva contraseña.</p>
        <SetPasswordForm onSubmit={handleSetPassword} submitLabel="Restablecer contraseña" />
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <div className="flex flex-col gap-4">
        {successMessage !== null && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-green-500/30 bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300"
          >
            {successMessage}
          </div>
        )}
        <OtpForm
          otpId={otpId}
          channel="email"
          identifier={email}
          onVerify={handleOtpVerify}
          onResend={handleOtpResend}
          onBack={() => {
            setStep('email');
          }}
          cooldownSeconds={30}
        />
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void form.handleSubmit(handleEmailSubmit)(e)}
      className="flex flex-col gap-4"
      noValidate
      aria-labelledby="recover-title"
    >
      {/* Rate limit error */}
      {globalError !== null && (
        <div
          role="alert"
          aria-live="assertive"
          className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm"
        >
          {globalError}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="recover-email">Correo electrónico</Label>
        <Input
          id="recover-email"
          type="email"
          autoComplete="email"
          placeholder="tu@empresa.com"
          aria-describedby={
            form.formState.errors.email !== undefined ? 'recover-email-error' : undefined
          }
          {...form.register('email')}
        />
        {form.formState.errors.email !== undefined && (
          <p id="recover-email-error" role="alert" className="text-destructive text-xs">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className="w-full">
        {isSubmitting ? 'Enviando...' : 'Enviar código'}
      </Button>
    </form>
  );
}
