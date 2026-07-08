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
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@core/ui';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { useState } from 'react';

import { USER_ROLES } from '../users.constants';
import type { AssignRoleInput, User } from '../users.types';

export interface AssignRoleDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** User to assign the role to */
  user: User;
  /** Callback to execute the assignment */
  onSubmit: (userId: string, data: AssignRoleInput) => Promise<void>;
  /** Whether an assignment operation is in progress */
  isLoading?: boolean;
}

type DialogMode = 'input' | 'success';

/**
 * Dialog to assign a role to a specific user.
 * Shows the user context and allows selecting from available roles.
 */
export function AssignRoleDialog({
  open,
  onOpenChange,
  user,
  onSubmit,
  isLoading = false,
}: AssignRoleDialogProps) {
  const [mode, setMode] = useState<DialogMode>('input');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setMode('input');
      setSelectedRole('');
      setError(null);
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async () => {
    if (!selectedRole) {
      setError('Debes seleccionar un rol');
      return;
    }

    setError(null);

    try {
      await onSubmit(user.id, { roleId: selectedRole });
      setMode('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al asignar el rol');
    }
  };

  const isSubmitDisabled = !selectedRole || isLoading;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar Rol</DialogTitle>
          <DialogDescription>
            {mode === 'input'
              ? `Selecciona un rol para asignar a ${user.name ?? user.email}`
              : 'Rol asignado exitosamente'}
          </DialogDescription>
        </DialogHeader>

        {mode === 'input' ? (
          <div className="space-y-4">
            {/* User context */}
            <div className="bg-muted rounded-md p-3">
              <p className="text-sm font-medium">{user.name ?? 'Sin nombre'}</p>
              <p className="text-muted-foreground text-sm">{user.email}</p>
            </div>

            {/* Role selection */}
            <div className="space-y-2">
              <Label htmlFor="role-select">Rol</Label>
              <Select
                value={selectedRole}
                onValueChange={(value) => {
                  setSelectedRole(value);
                  setError(null);
                }}
                disabled={isLoading}
              >
                <SelectTrigger id="role-select">
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Error display */}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <Alert>
            <CheckCircle className="text-success h-4 w-4" />
            <AlertDescription>
              <span className="font-medium">
                El rol ha sido asignado correctamente a {user.name ?? user.email}
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
                {isLoading ? 'Asignando...' : 'Asignar'}
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
