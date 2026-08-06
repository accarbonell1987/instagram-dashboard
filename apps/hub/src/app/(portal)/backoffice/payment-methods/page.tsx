'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@core/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState, type JSX } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { ApiError, ConflictError } from '@/lib/api/errors';
import {
  listPaymentMethods,
  updatePaymentMethod,
  type AdminPaymentMethodConfig,
  type PaymentMethodKind,
} from '@/modules/backoffice/payments';

// ─── Labels ─────────────────────────────────────────────────────────────────────

const METHOD_LABELS: Record<PaymentMethodKind, string> = {
  bancard: 'Bancard',
  bank_transfer: 'Transferencia bancaria',
};

const LAST_ENABLED_CODE = 'payment_method.last_enabled';
const NO_ACCOUNTS_CODE = 'payment_method.no_accounts_configured';

function conflictCode(err: ConflictError): string | undefined {
  return err.backendCode ?? err.problem?.detail;
}

// ─── Edit dialog ────────────────────────────────────────────────────────────────

const bankAccountSchema = z.object({
  bankName: z.string().min(1, 'El nombre del banco es obligatorio'),
  accountType: z.enum(['checking', 'savings']),
  accountNumber: z.string().min(1, 'El número de cuenta es obligatorio'),
  accountHolder: z.string().min(1, 'El titular de la cuenta es obligatorio'),
});

const editSchema = z.object({
  displayName: z.string().min(1, 'El nombre visible es obligatorio'),
  accounts: z.array(bankAccountSchema),
});

type EditFormData = z.infer<typeof editSchema>;

function EditMethodDialog({
  config,
  onOpenChange,
  onSaved,
}: {
  config: AdminPaymentMethodConfig | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: AdminPaymentMethodConfig) => void;
}): JSX.Element {
  const [error, setError] = useState('');
  const form = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: { displayName: '', accounts: [] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'accounts' });

  useEffect(() => {
    if (config !== null) {
      form.reset({ displayName: config.displayName ?? '', accounts: config.accounts ?? [] });
      setError('');
    }
  }, [config, form]);

  const isSubmitting = form.formState.isSubmitting;
  const showAccounts = config?.method === 'bank_transfer';

  function handleOpenChange(nextOpen: boolean): void {
    if (!nextOpen) setError('');
    onOpenChange(nextOpen);
  }

  async function handleSubmit(data: EditFormData): Promise<void> {
    if (config === null) return;
    setError('');
    try {
      const updated = await updatePaymentMethod(config.method, {
        enabled: config.enabled,
        displayName: data.displayName,
        accounts: showAccounts ? data.accounts : undefined,
      });
      onSaved(updated);
      toast.success(`${METHOD_LABELS[config.method]} actualizado`);
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof ConflictError && conflictCode(err) === NO_ACCOUNTS_CODE) {
        setError('Agregá al menos una cuenta bancaria antes de habilitar la transferencia bancaria.');
      } else {
        setError(err instanceof ApiError ? err.message : 'No se pudieron guardar los cambios');
      }
    }
  }

  return (
    <Dialog open={config !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar {config !== null ? METHOD_LABELS[config.method] : ''}</DialogTitle>
          <DialogDescription>
            {showAccounts
              ? 'Actualizá el nombre visible y las cuentas bancarias que ven los clientes.'
              : 'Actualizá el nombre visible que ven los clientes.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void form.handleSubmit(handleSubmit)(e)} noValidate className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="method-display-name">Nombre visible</Label>
            <Input
              id="method-display-name"
              disabled={isSubmitting}
              aria-invalid={form.formState.errors.displayName !== undefined}
              aria-describedby={
                form.formState.errors.displayName !== undefined ? 'method-display-name-error' : undefined
              }
              {...form.register('displayName')}
            />
            {form.formState.errors.displayName !== undefined && (
              <p id="method-display-name-error" role="alert" className="text-destructive text-xs">
                {form.formState.errors.displayName.message}
              </p>
            )}
          </div>

          {showAccounts && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Cuentas bancarias</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    append({ bankName: '', accountType: 'checking', accountNumber: '', accountHolder: '' });
                  }}
                >
                  Agregar cuenta
                </Button>
              </div>

              {fields.length === 0 ? (
                <p className="text-muted-foreground text-xs">Todavía no hay cuentas bancarias configuradas.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-border border-b">
                        <th className="text-muted-foreground py-2 pr-2 font-medium">Banco</th>
                        <th className="text-muted-foreground py-2 pr-2 font-medium">Tipo</th>
                        <th className="text-muted-foreground py-2 pr-2 font-medium">Número de cuenta</th>
                        <th className="text-muted-foreground py-2 pr-2 font-medium">Titular</th>
                        <th className="text-muted-foreground py-2 text-right font-medium">
                          <span className="sr-only">Eliminar</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-border divide-y">
                      {fields.map((field, index) => {
                        const rowError = form.formState.errors.accounts?.[index];
                        return (
                          <tr key={field.id}>
                            <td className="py-2 pr-2">
                              <Label htmlFor={`account-${index}-bankName`} className="sr-only">
                                Nombre del banco (cuenta {index + 1})
                              </Label>
                              <Input
                                id={`account-${index}-bankName`}
                                disabled={isSubmitting}
                                aria-invalid={rowError?.bankName !== undefined}
                                {...form.register(`accounts.${index}.bankName`)}
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <Label htmlFor={`account-${index}-accountType`} className="sr-only">
                                Tipo de cuenta (cuenta {index + 1})
                              </Label>
                              <Select
                                value={form.watch(`accounts.${index}.accountType`)}
                                onValueChange={(value) => {
                                  form.setValue(`accounts.${index}.accountType`, value as 'checking' | 'savings', {
                                    shouldValidate: true,
                                  });
                                }}
                                disabled={isSubmitting}
                              >
                                <SelectTrigger id={`account-${index}-accountType`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="checking">Cuenta corriente</SelectItem>
                                  <SelectItem value="savings">Caja de ahorro</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="py-2 pr-2">
                              <Label htmlFor={`account-${index}-accountNumber`} className="sr-only">
                                Número de cuenta (cuenta {index + 1})
                              </Label>
                              <Input
                                id={`account-${index}-accountNumber`}
                                disabled={isSubmitting}
                                aria-invalid={rowError?.accountNumber !== undefined}
                                {...form.register(`accounts.${index}.accountNumber`)}
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <Label htmlFor={`account-${index}-accountHolder`} className="sr-only">
                                Titular de la cuenta (cuenta {index + 1})
                              </Label>
                              <Input
                                id={`account-${index}-accountHolder`}
                                disabled={isSubmitting}
                                aria-invalid={rowError?.accountHolder !== undefined}
                                {...form.register(`accounts.${index}.accountHolder`)}
                              />
                            </td>
                            <td className="py-2 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => {
                                  remove(index);
                                }}
                                aria-label={`Eliminar cuenta ${index + 1}`}
                                disabled={isSubmitting}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {error !== '' && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                handleOpenChange(false);
              }}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PaymentMethodsPage(): JSX.Element {
  const [methods, setMethods] = useState<AdminPaymentMethodConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingMethod, setSavingMethod] = useState<PaymentMethodKind | null>(null);
  const [editingConfig, setEditingConfig] = useState<AdminPaymentMethodConfig | null>(null);

  const loadMethods = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listPaymentMethods();
      setMethods(result.items);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los métodos de pago');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMethods();
  }, [loadMethods]);

  async function handleToggle(method: PaymentMethodKind, enabled: boolean): Promise<void> {
    setSavingMethod(method);
    try {
      const updated = await updatePaymentMethod(method, { enabled });
      setMethods((prev) => prev.map((m) => (m.method === method ? updated : m)));
      toast.success(`${METHOD_LABELS[method]} ${enabled ? 'habilitado' : 'deshabilitado'}`);
    } catch (err: unknown) {
      if (err instanceof ConflictError && conflictCode(err) === LAST_ENABLED_CODE) {
        toast.error('Al menos un método de pago debe permanecer habilitado.');
      } else if (err instanceof ConflictError && conflictCode(err) === NO_ACCOUNTS_CODE) {
        toast.error('Agregá al menos una cuenta bancaria antes de habilitar la transferencia bancaria.');
      } else {
        toast.error(err instanceof ApiError ? err.message : 'No se pudo actualizar el método de pago');
      }
    } finally {
      setSavingMethod(null);
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Métodos de pago</h2>

      {error !== '' && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-muted-foreground p-4 text-sm">Cargando métodos de pago...</p>
      ) : (
        <div className="border-border divide-border bg-card divide-y rounded-lg border">
          {methods.map((config) => {
            const accountCount = config.accounts?.length ?? 0;
            return (
              <div key={config.method} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <Label htmlFor={`method-${config.method}`} className="font-medium">
                    {config.displayName ?? METHOD_LABELS[config.method]}
                  </Label>
                  {config.method === 'bank_transfer' && (
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {accountCount === 0
                        ? 'Todavía no hay cuentas bancarias configuradas.'
                        : `${accountCount} ${accountCount === 1 ? 'cuenta bancaria configurada' : 'cuentas bancarias configuradas'}.`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingConfig(config);
                    }}
                  >
                    Editar
                  </Button>
                  <Switch
                    id={`method-${config.method}`}
                    checked={config.enabled}
                    disabled={savingMethod !== null}
                    onCheckedChange={(checked) => {
                      void handleToggle(config.method, checked);
                    }}
                    aria-label={`${config.enabled ? 'Deshabilitar' : 'Habilitar'} ${METHOD_LABELS[config.method]}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EditMethodDialog
        config={editingConfig}
        onOpenChange={(open) => {
          if (!open) setEditingConfig(null);
        }}
        onSaved={(updated) => {
          setMethods((prev) => prev.map((m) => (m.method === updated.method ? updated : m)));
        }}
      />
    </div>
  );
}
