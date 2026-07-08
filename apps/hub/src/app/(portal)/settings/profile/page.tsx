'use client';

import { Button, Input, Label } from '@core/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type JSX } from 'react';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { z } from 'zod';

import { PhoneCompositeInput } from '@/modules/iam/onboarding/steps/step-2-representative/phone-composite-input';
import { updateProfile } from '@/modules/iam/invitations/services/invitation.service';
import { useSession } from '@/modules/iam/identity/hooks/use-session';

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfilePage(): JSX.Element {
  const { session } = useSession();
  const [apiError, setApiError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: session?.user.fullName ?? '',
      phone: session?.user.phone ?? '',
    },
  });

  const onSubmit: SubmitHandler<ProfileFormData> = async (data) => {
    setApiError(null);
    setSaveSuccess(false);
    try {
      await updateProfile({ fullName: data.fullName, phone: data.phone });
      setSaveSuccess(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message.length > 0
          ? err.message
          : 'Error al guardar el perfil. Intenta de nuevo.';
      setApiError(message);
    }
  };

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground">Mi perfil</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Actualizá tu nombre completo y teléfono de contacto.
        </p>
      </div>

      {apiError !== null && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {apiError}
        </div>
      )}

      {saveSuccess && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          ¡Perfil actualizado correctamente!
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {/* Full name */}
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

        {/* Phone */}
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

        <Button type="submit" className="mt-2 w-full sm:w-auto" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </form>
    </div>
  );
}
