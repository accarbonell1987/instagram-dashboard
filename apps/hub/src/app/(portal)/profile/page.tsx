'use client';

import { Badge, Button, Input, Label } from '@core/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState, type JSX } from 'react';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { z } from 'zod';

import { apiFetchWithInterceptors } from '@/lib/api/interceptors';
import type { SchemaUser } from '@/lib/api/types';
import { updateProfile } from '@/modules/iam/invitations/services/invitation.service';
import { PhoneCompositeInput } from '@/modules/iam/onboarding/steps/step-2-representative/phone-composite-input';

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

// ─── Identity ─────────────────────────────────────────────────────────────────

type TenantRole = 'SuperAdmin' | 'TenantAdmin' | 'User';

interface ProductRole {
  id: string;
  productName: string;
  name: string;
}

/** What each tenant role is called on screen. The enum is not for reading. */
const ROLE_LABELS: Record<TenantRole, string> = {
  SuperAdmin: 'Administrador de la plataforma',
  TenantAdmin: 'Administrador de la organización',
  User: 'Usuario',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfilePage(): JSX.Element {
  const [apiError, setApiError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [role, setRole] = useState<TenantRole | null>(null);
  const [productRoles, setProductRoles] = useState<ProductRole[]>([]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: '', phone: '' },
  });

  // El perfil se lee del endpoint, no de los claims del JWT: el token lleva
  // identidad y autorización, no datos de perfil editables. Leerlo del token
  // dejaba el teléfono vacío hasta que el usuario lo guardaba de nuevo.
  useEffect(() => {
    let cancelled = false;
    apiFetchWithInterceptors<{
      user: SchemaUser;
      role: TenantRole;
      productRoles?: ProductRole[];
    }>('/auth/me')
      .then((me) => {
        if (cancelled) return;
        reset({ fullName: me.user.fullName, phone: me.user.phone ?? '' });
        setRole(me.role);
        // Tolerated as absent: the contract requires it, but a server mid-deploy
        // may not send it yet, and a missing list should not blank the page.
        setProductRoles(me.productRoles ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setApiError('No pudimos cargar tu perfil. Recargá la página.');
      });
    return () => {
      cancelled = true;
    };
  }, [reset]);

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
    // Standalone route: the portal layout only clears the fixed header, so the
    // page owns its own container. mx-auto centres the single narrow column —
    // under /settings a sidebar used to sit to its left and provide the offset.
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6">
        <h1 className="text-foreground text-2xl font-semibold">Mi perfil</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Actualizá tu nombre completo y teléfono de contacto.
        </p>
      </div>

      {/* Read-only, and above the form on purpose: nobody edits their own role,
          and "why can't I see X?" is answered here rather than by asking an
          admin. The two axes are shown apart because they are apart — the
          organisation role governs the hub, the product role governs what a
          product opens. */}
      {role !== null && (
        <section className="border-border mb-6 flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium uppercase">
              Rol en la organización
            </span>
            <span className="text-foreground text-sm font-medium">{ROLE_LABELS[role]}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs font-medium uppercase">
              Accesos a productos
            </span>
            {productRoles.length === 0 ? (
              // No role does not mean no access: access is only narrowed once a
              // role exists, so saying "sin accesos" would be a lie.
              <span className="text-muted-foreground text-sm">
                Sin rol asignado — ves todo lo que incluye el plan.
              </span>
            ) : (
              <ul className="flex flex-col gap-1">
                {productRoles.map((productRole) => (
                  <li key={productRole.id} className="flex items-center gap-2 text-sm">
                    <Badge variant="secondary" className="text-xs">
                      {productRole.name}
                    </Badge>
                    <span className="text-muted-foreground">en {productRole.productName}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-muted-foreground text-xs">
              Los define un administrador de tu organización. Si necesitás otro acceso, pedíselo.
            </p>
          </div>
        </section>
      )}

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
