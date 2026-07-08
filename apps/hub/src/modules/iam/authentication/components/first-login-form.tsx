'use client';

import { Button, Input, Label } from '@core/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type JSX } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { firstLoginStart, verifyOtp, firstLoginSetPassword } from '../services/auth.service';

import { OtpForm } from './otp-form';
import { SetPasswordForm } from './set-password-form';

type Step = 'email' | 'otp' | 'set-password';

const emailSchema = z.object({
  email: z.string().email('Ingresá un correo electrónico válido'),
});

type EmailFormData = z.infer<typeof emailSchema>;

interface FirstLoginFormProps {
  initialEmail?: string | undefined;
  onSuccess?: () => void;
}

export function FirstLoginForm({ initialEmail = '', onSuccess }: FirstLoginFormProps): JSX.Element {

  const [step, setStep] = useState<Step>('email');
  const [otpId, setOtpId] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: initialEmail },
  });

  async function handleEmailSubmit(data: EmailFormData): Promise<void> {
    setIsSubmitting(true);
    setGlobalError(null);

    try {
      const result = await firstLoginStart({ email: data.email });
      setOtpId(result.otpId);
      setEmail(data.email);
      setStep('otp');
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message.length > 0
          ? err.message
          : 'No se pudo iniciar el proceso. Verificá tu correo e intentá de nuevo.';
      setGlobalError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOtpVerify(code: string, _trustDevice: boolean): Promise<void> {
    const result = await verifyOtp({ otpId, code });
    setVerificationToken(result.verificationToken);
    setStep('set-password');
  }

  async function handleOtpResend(): Promise<void> {
    const result = await firstLoginStart({ email });
    setOtpId(result.otpId);
  }

  async function handleSetPassword(password: string): Promise<void> {
    await firstLoginSetPassword({ otpVerificationToken: verificationToken, password });
    onSuccess?.();
  }

  if (step === 'set-password') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          Configurá tu contraseña para activar tu cuenta.
        </p>
        <SetPasswordForm onSubmit={handleSetPassword} submitLabel="Activar cuenta" />
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <OtpForm
        otpId={otpId}
        channel="email"
        identifier={email}
        onVerify={handleOtpVerify}
        onResend={handleOtpResend}
        onBack={() => { setStep('email'); }}
        cooldownSeconds={30}
      />
    );
  }

  return (
    <form
      onSubmit={(e) => void form.handleSubmit(handleEmailSubmit)(e)}
      className="flex flex-col gap-4"
      noValidate
      aria-labelledby="first-login-title"
    >
      {globalError !== null && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {globalError}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="first-login-email">Correo electrónico</Label>
        <Input
          id="first-login-email"
          type="email"
          autoComplete="email"
          placeholder="tu@empresa.com"
          aria-describedby={
            form.formState.errors.email !== undefined ? 'first-login-email-error' : undefined
          }
          {...form.register('email')}
        />
        {form.formState.errors.email !== undefined && (
          <p id="first-login-email-error" role="alert" className="text-destructive text-xs">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className="w-full">
        {isSubmitting ? 'Enviando...' : 'Continuar'}
      </Button>
    </form>
  );
}
