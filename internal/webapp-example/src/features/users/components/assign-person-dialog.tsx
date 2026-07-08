'use client';

import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@core/ui';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { useState } from 'react';

import type { AssignPersonInput, User } from '../users.types';

export interface AssignPersonDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** User to link to a party/person */
  user: User;
  /** Callback to execute the assignment */
  onSubmit: (userId: string, data: AssignPersonInput) => Promise<void>;
  /** Whether an assignment operation is in progress */
  isLoading?: boolean;
}

type DialogMode = 'input' | 'success';

/**
 * Dialog to link a user to a party/person.
 * Shows the user context and allows entering a party ID.
 */
export function AssignPersonDialog({
  open,
  onOpenChange,
  user,
  onSubmit,
  isLoading = false,
}: AssignPersonDialogProps) {
  const [mode, setMode] = useState<DialogMode>('input');
  const [partyId, setPartyId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setMode('input');
      setPartyId('');
      setError(null);
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async () => {
    const trimmedPartyId = partyId.trim();

    if (!trimmedPartyId) {
      setError('El ID de persona/entidad es requerido');
      return;
    }

    setError(null);

    try {
      await onSubmit(user.id, { partyId: trimmedPartyId });
      setMode('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al vincular la persona');
    }
  };

  const isSubmitDisabled = !partyId.trim() || isLoading;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular Persona</DialogTitle>
          <DialogDescription>
            {mode === 'input'
              ? `Vincula una persona o entidad a ${user.name ?? user.email}`
              : 'Persona vinculada exitosamente'}
          </DialogDescription>
        </DialogHeader>

        {mode === 'input' ? (
          <div className="space-y-4">
            {/* User context */}
            <div className="bg-muted rounded-md p-3">
              <p className="text-sm font-medium">{user.name ?? 'Sin nombre'}</p>
              <p className="text-muted-foreground text-sm">{user.email}</p>
              {user.partyId && (
                <p className="text-muted-foreground mt-1 text-xs">
                  Party ID actual: {user.partyId}
                </p>
              )}
            </div>

            {/* Party ID input */}
            <div className="space-y-2">
              <Label htmlFor="party-id-input">ID de Persona/Entidad</Label>
              <Input
                id="party-id-input"
                type="text"
                placeholder="Ingresa el ID de la persona o entidad"
                value={partyId}
                onChange={(e) => {
                  setPartyId(e.target.value);
                  setError(null);
                }}
                disabled={isLoading}
                aria-describedby={error ? 'party-id-error' : undefined}
              />
              <p className="text-muted-foreground text-xs">
                Ingresa el identificador único de la persona o entidad a vincular
              </p>
            </div>

            {/* Error display */}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription id="party-id-error">{error}</AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <Alert>
            <CheckCircle className="text-success h-4 w-4" />
            <AlertDescription>
              <span className="font-medium">
                La persona ha sido vinculada correctamente a {user.name ?? user.email}
              </span>
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          {mode === 'input' ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  handleOpenChange(false);
                }}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitDisabled}>
                {isLoading ? 'Vinculando...' : 'Vincular'}
              </Button>
            </>
          ) : (
            <Button
              onClick={() => {
                handleOpenChange(false);
              }}
            >
              Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
