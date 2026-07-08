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

export interface RevokeConfirmDialogProps {
  email: string | null;
  invitationId: string | null;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function RevokeConfirmDialog({
  email,
  invitationId,
  onConfirm,
  onCancel,
}: RevokeConfirmDialogProps): JSX.Element {
  const [isRevoking, setIsRevoking] = useState(false);

  async function handleConfirm(): Promise<void> {
    setIsRevoking(true);
    try {
      await onConfirm();
    } finally {
      setIsRevoking(false);
    }
  }

  return (
    <AlertDialog open={email !== null && invitationId !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revocar invitación</AlertDialogTitle>
          <AlertDialogDescription>
            {email !== null && (
              <>
                ¿Revocar invitación para <strong>{email}</strong>?
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={isRevoking}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => void handleConfirm()}
            disabled={isRevoking}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isRevoking ? 'Revocando...' : 'Revocar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
