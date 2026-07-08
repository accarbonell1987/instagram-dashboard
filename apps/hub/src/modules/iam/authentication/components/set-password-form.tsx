'use client';

import { Button, Label, PasswordInput } from '@core/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useState, type JSX } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';

import {
  buildPasswordSchema,
  evaluatePasswordChecklist,
  type PasswordPolicy,
} from '../lib/password-policy';
import { getPasswordPolicy } from '../services/auth.service';

export interface SetPasswordFormProps {
  onSubmit: (password: string) => Promise<void>;
  submitLabel?: string;
}

const confirmSchema = z.object({ password: z.string(), confirm: z.string() });
type FormData = z.infer<typeof confirmSchema>;

// Default policy used while query is loading — mirrors the actual backend policy
// so that validation feels consistent even before the /auth/password/policy response arrives.
const DEFAULT_POLICY: PasswordPolicy = {
  minLength: 12,
  requireUpper: true,
  requireLower: true,
  requireDigit: true,
  requireSymbol: true,
  disallowCommon: false,
};

export function SetPasswordForm({
  onSubmit,
  submitLabel = 'Guardar contraseña',
}: SetPasswordFormProps): JSX.Element {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const { data: policy, isLoading } = useQuery<PasswordPolicy>({
    queryKey: ['password-policy'],
    queryFn: getPasswordPolicy,
    staleTime: 5 * 60 * 1000, // 5 minutes — policy rarely changes
    retry: false,
  });

  const activePolicy = policy ?? DEFAULT_POLICY;

  const form = useForm<FormData>({
    resolver: zodResolver(
      confirmSchema
        .superRefine((data, ctx) => {
          const passwordSchema = buildPasswordSchema(activePolicy);
          const result = passwordSchema.safeParse(data.password);
          if (!result.success) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: result.error.errors[0]?.message ?? 'Contraseña inválida',
              path: ['password'],
            });
          }
        })
        .refine((data) => data.password === data.confirm, {
          message: 'Las contraseñas no coinciden',
          path: ['confirm'],
        })
    ),
    defaultValues: { password: '', confirm: '' },
    mode: 'onChange',
  });

  const passwordValue = form.watch('password');
  const checklist = evaluatePasswordChecklist(activePolicy, passwordValue);
  const allRulesPass = checklist.every((item) => item.passes);

  const handleSubmit: SubmitHandler<FormData> = async (data) => {
    setIsSubmitting(true);
    setGlobalError(null);

    try {
      await onSubmit(data.password);
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message.length > 0
          ? err.message
          : 'Error al guardar la contraseña.';
      setGlobalError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(e) => void form.handleSubmit(handleSubmit)(e)}
      className="flex flex-col gap-4"
      noValidate
    >
      {globalError !== null && (
        <div
          role="alert"
          aria-live="assertive"
          className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm"
        >
          {globalError}
        </div>
      )}

      {/* Password input */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-password">Nueva contraseña</Label>
        <PasswordInput
          id="new-password"
          autoComplete="new-password"
          aria-describedby="password-rules"
          {...form.register('password')}
        />
        {form.formState.errors.password !== undefined && (
          <p role="alert" className="text-destructive text-xs">
            {form.formState.errors.password.message}
          </p>
        )}
      </div>

      {/* Live checklist */}
      {!isLoading && checklist.length > 0 && (
        <ul
          id="password-rules"
          aria-live="polite"
          aria-label="Requisitos de contraseña"
          className="flex flex-col gap-1"
        >
          {checklist.map((item) => (
            <li
              key={item.rule}
              className={`flex items-center gap-2 text-xs ${item.passes ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
            >
              <span aria-hidden="true">{item.passes ? '✓' : '○'}</span>
              {item.label}
            </li>
          ))}
        </ul>
      )}

      {/* Confirm */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm-password">Confirmar contraseña</Label>
        <PasswordInput
          id="confirm-password"
          autoComplete="new-password"
          aria-describedby={
            form.formState.errors.confirm !== undefined ? 'confirm-error' : undefined
          }
          {...form.register('confirm')}
        />
        {form.formState.errors.confirm !== undefined && (
          <p id="confirm-error" role="alert" className="text-destructive text-xs">
            {form.formState.errors.confirm.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={!form.formState.isValid || isSubmitting || isLoading}
        aria-busy={isSubmitting}
        className="w-full"
      >
        {isSubmitting ? 'Guardando...' : submitLabel}
      </Button>
    </form>
  );
}
