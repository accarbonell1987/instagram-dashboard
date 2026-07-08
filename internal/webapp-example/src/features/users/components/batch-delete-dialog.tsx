'use client';

import type { BatchDeleteResult } from '@core/core/services';
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@core/ui';
import { AlertTriangle } from 'lucide-react';

export interface BatchDeleteDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Number of items to be deleted */
  selectedCount: number;
  /** Callback to execute the batch delete */
  onConfirm: () => Promise<BatchDeleteResult>;
  /** Whether a delete operation is in progress */
  isDeleting?: boolean;
  /** Result from a previous delete attempt (for partial failure display) */
  result?: BatchDeleteResult | null;
}

/**
 * Confirmation dialog for batch deletion.
 * Shows count of users to delete and handles partial failure results.
 */
export function BatchDeleteDialog({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
  isDeleting = false,
  result,
}: BatchDeleteDialogProps) {
  const notFoundList = result?.notFound ?? [];
  const hasPartialFailure = notFoundList.length > 0;

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="text-destructive h-5 w-5" />
            ¿Eliminar {selectedCount} {selectedCount === 1 ? 'usuario' : 'usuarios'}?
          </DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer. Los usuarios seleccionados serán eliminados
            permanentemente.
          </DialogDescription>
        </DialogHeader>

        {hasPartialFailure && result && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium">
                {result.deleted} {result.deleted === 1 ? 'eliminado' : 'eliminados'},{' '}
                {notFoundList.length} {notFoundList.length === 1 ? 'fallido' : 'fallidos'}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                IDs no encontrados: {notFoundList.join(', ')}
              </p>
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isDeleting}>
              Cancelar
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleConfirm} disabled={isDeleting}>
            {isDeleting ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
