'use client';

import { Button } from '@core/ui';
import { Trash2, X } from 'lucide-react';

export interface BatchActionToolbarProps {
  /** Number of selected items */
  selectedCount: number;
  /** Callback when delete button is clicked */
  onDelete: () => void;
  /** Callback when clear selection button is clicked */
  onClear: () => void;
  /** Whether a delete operation is in progress */
  isDeleting?: boolean;
}

/**
 * Fixed-position toolbar that appears when rows are selected.
 * Shows selection count and batch action buttons.
 */
export function BatchActionToolbar({
  selectedCount,
  onDelete,
  onClear,
  isDeleting = false,
}: BatchActionToolbarProps) {
  if (selectedCount === 0) {
    return null;
  }

  const selectionText =
    selectedCount === 1
      ? '1 usuario seleccionado'
      : `${String(selectedCount)} usuarios seleccionados`;

  return (
    <div
      className="bg-background/95 supports-[backdrop-filter]:bg-background/60 fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-lg border px-4 py-3 shadow-lg backdrop-blur"
      role="toolbar"
      aria-label="Acciones de selección masiva"
    >
      <span className="text-muted-foreground text-sm font-medium">{selectionText}</span>

      <div className="bg-border h-6 w-px" />

      <div className="flex items-center gap-2">
        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          disabled={isDeleting}
          aria-label={`Eliminar ${String(selectedCount)} usuarios seleccionados`}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {isDeleting ? 'Eliminando...' : 'Eliminar seleccionados'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          disabled={isDeleting}
          aria-label="Limpiar selección"
        >
          <X className="mr-2 h-4 w-4" />
          Limpiar selección
        </Button>
      </div>
    </div>
  );
}
