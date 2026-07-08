'use client';

import { Button, Input, Label } from '@core/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type JSX } from 'react';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { z } from 'zod';

import { PhoneCompositeInput } from '@/modules/iam/onboarding/steps/step-2-representative/phone-composite-input';
import { updateProfile } from '../services/invitation.service';

// ─── Schema ───────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  fullName: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar los 100 caracteres'),
  phone: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, 'Ingresá un número en formato internacional (ej. +595981000000)'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CompleteProfileStepProps {
  onSuccess: () => void;
  onSkip: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CompleteProfileStep({ onSuccess, onSkip }: CompleteProfileStepProps): JSX.Element {
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: '', phone: '' },
  });

  const onSubmit: SubmitHandler<ProfileFormData> = async (data) => {
    setApiError(null);
    try {
      await updateProfile({ fullName: data.fullName, phone: data.phone });
      onSuccess();
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message.length > 0
          ? err.message
          : 'Error al guardar el perfil. Intenta de nuevo.';
      setApiError(message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Completá tu perfil</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Añadí tu nombre completo y teléfono para que tu equipo pueda identificarte.
        </p>
      </div>

      {apiError !== null && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {/* Full name field */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fullName">Nombre completo</Label>
          <Input
            id="fullName"
            type="text"
            placeholder="Ana Pereira"
            aria-invalid={errors.fullName !== undefined}
            aria-describedby={errors.fullName !== undefined ? 'fullName-error' : undefined}
            {...register('fullName')}
          />
          {errors.fullName !== undefined && (
            <p id="fullName-error" className="text-sm text-destructive" role="alert">
              {errors.fullName.message}
            </p>
          )}
        </div>

        {/* Phone field */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Teléfono</Label>
          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <PhoneCompositeInput
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={errors.phone !== undefined}
                {...(errors.phone !== undefined ? { errorId: 'phone-error' } : {})}
              />
            )}
          />
          {errors.phone !== undefined && (
            <p id="phone-error" className="text-sm text-destructive" role="alert">
              {errors.phone.message}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-2">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Continuar'}
          </Button>
          <Button
            type="button"
            variant="link"
            onClick={onSkip}
            className="text-sm"
          >
            Saltar por ahora
          </Button>
        </div>
      </form>
    </div>
  );
}
