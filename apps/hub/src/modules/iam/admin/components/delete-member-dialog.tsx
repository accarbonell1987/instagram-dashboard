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
  Input,
} from '@core/ui';
import { useState, type JSX } from 'react';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface DeleteMemberDialogProps {
  memberId: string | null;
  memberEmail: string | null;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function DeleteMemberDialog({
  memberId,
  memberEmail,
  onConfirm,
  onCancel,
}: DeleteMemberDialogProps): JSX.Element {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfirmEnabled =
    memberEmail !== null && inputValue.toLowerCase() === memberEmail.toLowerCase();

  async function handleConfirm() {
    if (!isConfirmEnabled) return;
    setIsLoading(true);
    setError(null);
    try {
      await onConfirm();
      setInputValue('');
    } catch {
      setError('Error al eliminar el miembro. Intenta nuevamente.');
      setIsLoading(false);
    }
  }

  function handleCancel() {
    setInputValue('');
    setError(null);
    onCancel();
  }

  return (
    <AlertDialog open={memberId !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar miembro?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. El usuario perderá acceso permanentemente.
            {memberEmail !== null && (
              <>
                {' '}
                Escribe <strong>{memberEmail}</strong> para confirmar.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-1.5">
          <Input
            type="email"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={memberEmail ?? 'email del miembro'}
            disabled={isLoading}
            aria-label="Confirmar email del miembro"
          />
        </div>
        {error !== null && <p className="text-destructive text-sm">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={isLoading}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => void handleConfirm()}
            disabled={!isConfirmEnabled || isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? '…' : 'Eliminar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
