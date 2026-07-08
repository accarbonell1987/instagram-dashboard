'use client';

import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@core/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type JSX } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';

import { createAdminInvitation } from '../services/invitation.service';

import { ConflictError } from '@/lib/api/errors';

// ─── Schema ────────────────────────────────────────────────────────────────────

const inviteSchema = z.object({
  email: z.string().email('Email inválido'),
  role: z.enum(['User', 'TenantAdmin']),
});

type InviteFormData = z.infer<typeof inviteSchema>;

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface InviteFormProps {
  onSuccess: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function InviteForm({ onSuccess }: InviteFormProps): JSX.Element {
  const [globalError, setGlobalError] = useState<string | null>(null);

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'User' },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function handleSubmit(data: InviteFormData): Promise<void> {
    setGlobalError(null);
    try {
      await createAdminInvitation({ email: data.email, role: data.role });
      form.reset();
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof ConflictError) {
        const detail = err.problem?.detail ?? '';
        if (detail === 'invitation.pending_exists') {
          setGlobalError('Ya existe una invitación pendiente para este email');
        } else if (detail === 'invitation.active_user_exists') {
          setGlobalError('Este email ya tiene una cuenta activa en el tenant');
        } else {
          setGlobalError('Ocurrió un error al enviar la invitación');
        }
      } else {
        setGlobalError('Ocurrió un error al enviar la invitación');
      }
    }
  }

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

      <div className="flex w-full flex-col items-center gap-4 sm:flex-row sm:items-end">
        {/* Email */}
        <div className="flex w-full flex-col gap-1.5">
          <Label htmlFor="invite-email">Correo electrónico</Label>
          <Input
            id="invite-email"
            type="email"
            autoComplete="email"
            placeholder="usuario@empresa.com"
            aria-describedby={
              form.formState.errors.email !== undefined ? 'invite-email-error' : undefined
            }
            {...form.register('email')}
          />
          {form.formState.errors.email !== undefined && (
            <p id="invite-email-error" role="alert" className="text-destructive text-xs">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        {/* Role */}
        <div className="flex w-full flex-col gap-1.5">
          <Label htmlFor="invite-role">Rol</Label>
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id="invite-role"
                  aria-describedby={
                    form.formState.errors.role !== undefined ? 'invite-role-error' : undefined
                  }
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="User">Usuario</SelectItem>
                  <SelectItem value="TenantAdmin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {form.formState.errors.role !== undefined && (
            <p id="invite-role-error" role="alert" className="text-destructive text-xs">
              {form.formState.errors.role.message}
            </p>
          )}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="w-full sm:w-fit"
        >
          {isSubmitting ? 'Enviando...' : 'Invitar'}
        </Button>
      </div>
    </form>
  );
}
