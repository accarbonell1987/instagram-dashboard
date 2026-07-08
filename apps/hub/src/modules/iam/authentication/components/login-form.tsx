'use client';

import { Button, Input, Label, PasswordInput } from '@core/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState, type JSX } from 'react';
import { useForm } from 'react-hook-form';

import { credentialsSchema } from '../lib/login-schema';
import type { CredentialsFormData } from '../lib/login-schema';
import { login, completeLogin, sendOtp } from '../services/auth.service';

import { OtpForm } from './otp-form';

import { AuthError, ForbiddenError, RateLimitError } from '@/lib/api/errors';

type Step = 'credentials' | 'otp';

export function LoginForm(): JSX.Element {
  const router = useRouter();

  const [step, setStep] = useState<Step>('credentials');
  const [otpId, setOtpId] = useState('');
  const [otpChannel, setOtpChannel] = useState<'email' | 'sms'>('email');
  const [email, setEmail] = useState('');
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CredentialsFormData>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: '', password: '' },
  });

  async function handleCredentialsSubmit(data: CredentialsFormData): Promise<void> {
    setIsSubmitting(true);
    setGlobalError(null);

    try {
      const result = await login({ email: data.email, password: data.password });

      if (!result.otpRequired) {
        // Trusted device — session already applied by auth.service, redirect directly
        router.push('/');
        return;
      }

      setOtpId(result.otpId);
      setOtpChannel(result.otpChannel);
      setEmail(data.email);
      setStep('otp');
    } catch (err: unknown) {
      if (err instanceof RateLimitError) {
        const seconds = err.retryAfterSeconds;
        const minutes = Math.ceil(seconds / 60);
        setGlobalError(
          `Tu cuenta está temporalmente bloqueada. Podés intentar de nuevo en ${String(minutes)} minuto${minutes === 1 ? '' : 's'}.`
        );
      } else if (err instanceof ForbiddenError) {
        setGlobalError('Tu cuenta está suspendida. Contactá con soporte.');
      } else if (err instanceof AuthError) {
        setGlobalError('Correo o contraseña incorrectos. Verificá tus datos e intentá de nuevo.');
      } else {
        setGlobalError('Ocurrió un error inesperado. Intentá de nuevo.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOtpVerify(code: string, trustDevice: boolean): Promise<void> {
    await completeLogin({ otpId, code, trustDevice });

    router.push('/');
  }

  async function handleOtpResend(): Promise<void> {
    await sendOtp({
      channel: otpChannel,
      purpose: 'login',
      identifier: email,
    });
  }

  if (step === 'otp') {
    return (
      <OtpForm
        otpId={otpId}
        channel={otpChannel}
        identifier={email}
        onVerify={handleOtpVerify}
        onResend={handleOtpResend}
        onBack={() => {
          setStep('credentials');
        }}
        showTrustDevice={true}
        cooldownSeconds={30}
      />
    );
  }

  return (
    <form
      onSubmit={(e) => void form.handleSubmit(handleCredentialsSubmit)(e)}
      className="flex flex-col gap-4"
      noValidate
      aria-labelledby="login-title"
    >
      {/* Global error */}
      {globalError !== null && (
        <div
          role="alert"
          aria-live="assertive"
          className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm"
        >
          {globalError}
        </div>
      )}

      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="tu@empresa.com"
          aria-describedby={form.formState.errors.email !== undefined ? 'email-error' : undefined}
          {...form.register('email')}
        />
        {form.formState.errors.email !== undefined && (
          <p id="email-error" role="alert" className="text-destructive text-xs">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Contraseña</Label>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          aria-describedby={
            form.formState.errors.password !== undefined ? 'password-error' : undefined
          }
          {...form.register('password')}
        />
        {form.formState.errors.password !== undefined && (
          <p id="password-error" role="alert" className="text-destructive text-xs">
            {form.formState.errors.password.message}
          </p>
        )}
      </div>

      {/* Submit */}
      <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className="w-full">
        {isSubmitting ? 'Ingresando...' : 'Ingresar'}
      </Button>
    </form>
  );
}
