'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@core/ui';
import { useState, type JSX } from 'react';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface SuspendConfirmDialogProps {
  email: string | null;
  memberId: string | null;
  action: 'suspend' | 'activate';
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function SuspendConfirmDialog({
  email,
  memberId,
  action,
  onConfirm,
  onCancel,
}: SuspendConfirmDialogProps): JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setIsLoading(true);
    setError(null);
    try {
      await onConfirm();
    } catch {
      setError('Error al realizar la acción. Intenta nuevamente.');
      setIsLoading(false);
    }
  }

  const title = action === 'suspend' ? '¿Suspender acceso?' : '¿Activar acceso?';
  const description =
    action === 'suspend'
      ? 'El usuario perderá acceso. Su sesión activa expirará en los próximos 15 minutos.'
      : 'El usuario podrá iniciar sesión nuevamente.';
  const confirmLabel = action === 'suspend' ? 'Suspender' : 'Activar';

  return (
    <AlertDialog open={memberId !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
            {email !== null && (
              <>
                {' '}
                <strong>{email}</strong>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error !== null && <p className="text-destructive text-sm">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={isLoading}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => void handleConfirm()} disabled={isLoading}>
            {isLoading ? '…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
