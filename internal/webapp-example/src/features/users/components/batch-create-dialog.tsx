'use client';

import type { BatchCreateResult } from '@core/core/services';
import {
  Alert,
  AlertDescription,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from '@core/ui';
import { CheckCircle, ChevronDown, XCircle } from 'lucide-react';
import { useState } from 'react';

import type { User, UserCreate } from '../users.types';

export interface BatchCreateDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback to execute the batch create */
  onSubmit: (users: UserCreate[]) => Promise<BatchCreateResult<User>>;
  /** Whether a create operation is in progress */
  isCreating?: boolean;
}

type DialogMode = 'input' | 'results';

interface ValidationError {
  index: number;
  message: string;
}

const PLACEHOLDER_JSON = `[
  { "email": "usuario1@ejemplo.com", "name": "Usuario 1" },
  { "email": "usuario2@ejemplo.com", "name": "Usuario 2" }
]`;

/**
 * Parse and validate JSON input for batch user creation.
 * Returns either parsed users or a validation error message.
 */
function parseUserJson(input: string): { users?: UserCreate[]; error?: string } {
  if (!input.trim()) {
    return { error: 'El campo no puede estar vacío' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    return { error: 'JSON inválido. Verifica la sintaxis.' };
  }

  if (!Array.isArray(parsed)) {
    return { error: 'El JSON debe ser un array de usuarios' };
  }

  if (parsed.length === 0) {
    return { error: 'El array debe contener al menos un usuario' };
  }

  // Validate each item has required fields
  const errors: ValidationError[] = [];
  const users: UserCreate[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const item: unknown = parsed[i];

    if (typeof item !== 'object' || item === null) {
      errors.push({ index: i, message: 'Debe ser un objeto' });
      continue;
    }

    const itemObj = item as Record<string, unknown>;
    const email = itemObj['email'];
    const name = itemObj['name'];
    const partyId = itemObj['partyId'];

    if (typeof email !== 'string' || !email.trim()) {
      errors.push({ index: i, message: 'Email es requerido' });
      continue;
    }

    // Basic email validation
    if (!email.includes('@')) {
      errors.push({ index: i, message: 'Email inválido' });
      continue;
    }

    users.push({
      email: email,
      name: typeof name === 'string' ? name : undefined,
      partyId: typeof partyId === 'string' ? partyId : '',
    });
  }

  if (errors.length > 0) {
    return {
      error: errors.map((e) => `Elemento ${String(e.index + 1)}: ${e.message}`).join('; '),
    };
  }

  return { users };
}

/**
 * Dialog for importing multiple users via JSON input.
 * Shows validation errors inline and results after submission.
 */
export function BatchCreateDialog({
  open,
  onOpenChange,
  onSubmit,
  isCreating = false,
}: BatchCreateDialogProps) {
  const [mode, setMode] = useState<DialogMode>('input');
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [result, setResult] = useState<BatchCreateResult<User> | null>(null);
  const [errorsExpanded, setErrorsExpanded] = useState(false);

  // Reset state when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setMode('input');
      setJsonInput('');
      setJsonError(null);
      setResult(null);
      setErrorsExpanded(false);
    }
    onOpenChange(isOpen);
  };

  // Validate JSON as user types
  const handleInputChange = (value: string) => {
    setJsonInput(value);

    if (!value.trim()) {
      setJsonError(null);
      return;
    }

    const { error } = parseUserJson(value);
    setJsonError(error ?? null);
  };

  const handleSubmit = async () => {
    const { users, error } = parseUserJson(jsonInput);

    if (error || !users) {
      setJsonError(error ?? 'Error de validación');
      return;
    }

    try {
      const createResult = await onSubmit(users);
      setResult(createResult);
      setMode('results');
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Error al crear usuarios');
    }
  };

  const isSubmitDisabled = !jsonInput.trim() || !!jsonError || isCreating;

  // Calculate failed count (total submitted - created)
  const failedCount = result ? result.total - result.created.length : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Usuarios</DialogTitle>
          <DialogDescription>
            {mode === 'input'
              ? 'Ingresa un array JSON con los usuarios a crear.'
              : 'Resultados de la importación'}
          </DialogDescription>
        </DialogHeader>

        {mode === 'input' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="json-input">Datos JSON</Label>
              <Textarea
                id="json-input"
                placeholder={PLACEHOLDER_JSON}
                value={jsonInput}
                onChange={(e) => {
                  handleInputChange(e.target.value);
                }}
                className="font-mono text-sm"
                rows={8}
                disabled={isCreating}
                aria-describedby={jsonError ? 'json-error' : undefined}
              />
              {jsonError && (
                <p id="json-error" className="text-destructive text-sm" role="alert">
                  {jsonError}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {result && (
              <>
                {result.created.length > 0 && (
                  <Alert>
                    <CheckCircle className="text-success h-4 w-4" />
                    <AlertDescription>
                      <span className="font-medium">
                        {result.created.length}{' '}
                        {result.created.length === 1 ? 'usuario creado' : 'usuarios creados'}{' '}
                        exitosamente
                      </span>
                    </AlertDescription>
                  </Alert>
                )}

                {failedCount > 0 && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      <span className="font-medium">
                        {failedCount} {failedCount === 1 ? 'error' : 'errores'}
                      </span>
                    </AlertDescription>
                  </Alert>
                )}

                {result.created.length > 0 && (
                  <Collapsible open={errorsExpanded} onOpenChange={setErrorsExpanded}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="flex items-center gap-1">
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            errorsExpanded ? 'rotate-180' : ''
                          }`}
                        />
                        Ver usuarios creados
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <ul className="text-muted-foreground space-y-1 text-sm">
                        {result.created.map((user) => (
                          <li key={user.id} className="flex items-center gap-2">
                            <CheckCircle className="text-success h-3 w-3" />
                            {user.email}
                            {user.name && (
                              <span className="text-muted-foreground">({user.name})</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter>
          {mode === 'input' ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  handleOpenChange(false);
                }}
                disabled={isCreating}
              >
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitDisabled}>
                {isCreating ? 'Creando...' : 'Crear'}
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
