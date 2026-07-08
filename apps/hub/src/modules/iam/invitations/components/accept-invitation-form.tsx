'use client';

import { Button } from '@core/ui';
import { useRouter } from 'next/navigation';
import { useState, type JSX } from 'react';

import { roleLabel } from '../lib/role-label';
import { acceptInvitation } from '../services/invitation.service';
import { CompleteProfileStep } from './complete-profile-step';

import { SetPasswordForm } from '@/modules/iam/authentication/components/set-password-form';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AcceptInvitationFormProps {
  token: string;
  invitation: {
    email: string;
    tenantName: string;
    inviterName?: string | undefined;
    role: 'TenantAdmin' | 'User';
  };
}

type Step = 'preview' | 'set-password' | 'complete-profile';

// ─── Component ────────────────────────────────────────────────────────────────

export function AcceptInvitationForm({ token, invitation }: AcceptInvitationFormProps): JSX.Element {
  const router = useRouter();
  const [step, setStep] = useState<Step>('preview');
  const [error, setError] = useState<string | null>(null);

  const roleName = roleLabel(invitation.role);

  async function handlePasswordSubmit(password: string): Promise<void> {
    setError(null);
    try {
      await acceptInvitation({ token, password });
      setStep('complete-profile');
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message.length > 0
          ? err.message
          : 'Error al aceptar la invitación. Intenta de nuevo.';
      setError(message);
    }
  }

  if (step === 'complete-profile') {
    return (
      <CompleteProfileStep
        onSuccess={() => { router.push('/'); }}
        onSkip={() => { router.push('/'); }}
      />
    );
  }

  if (step === 'set-password') {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Creá tu contraseña</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Accederás como <strong>{roleName}</strong> en{' '}
            <strong>{invitation.tenantName}</strong>.
          </p>
        </div>

        {error !== null && (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        <SetPasswordForm
          onSubmit={handlePasswordSubmit}
          submitLabel="Crear cuenta y acceder"
        />
      </div>
    );
  }

  // step === 'preview'
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Fuiste invitado a{' '}
          <span className="text-primary">{invitation.tenantName}</span>
        </h2>

        {invitation.inviterName != null && (
          <p className="mt-2 text-muted-foreground">
            <strong>{invitation.inviterName}</strong> te invitó como{' '}
            <strong>{roleName}</strong>
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Correo electrónico
        </p>
        <p className="mt-1 text-sm font-medium text-foreground">{invitation.email}</p>
      </div>

      <Button
        type="button"
        className="w-full"
        aria-label={`Aceptar invitación de ${invitation.tenantName}`}
        onClick={() => { setStep('set-password'); }}
      >
        Aceptar invitación
      </Button>
    </div>
  );
}
