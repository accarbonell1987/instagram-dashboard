'use client';

import { BankAccountCard, Button, DataTable, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Td, Th, Tr } from '@core/ui';
import type { BankAccountField } from '@core/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Trash2 } from 'lucide-react';
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

// BankAccountCard ships English defaults on purpose — @core/ui is shared by
// every app and by the ones the CLI generates, so it cannot own one product's
// language. The hub supplies its own.
const BANK_ACCOUNT_CARD_LABELS = {
  accountHolder: 'Titular',
  accountType: 'Tipo de cuenta',
  checking: 'Cuenta corriente',
  savings: 'Caja de ahorro',
  reveal: 'Ver número completo',
  hide: 'Ocultar número',
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
type BankAccountFormValues = z.infer<typeof bankAccountSchema>;

const EMPTY_ACCOUNT: BankAccountFormValues = {
  bankName: '',
  accountType: 'checking',
  accountNumber: '',
  accountHolder: '',
};

function accountTypeLabel(type: BankAccountFormValues['accountType']): string {
  return type === 'checking' ? BANK_ACCOUNT_CARD_LABELS.checking : BANK_ACCOUNT_CARD_LABELS.savings;
}

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
  // The account currently open in the inline edit panel — at most one at a
  // time, so there is no ambiguity about which row the preview card reflects.
  const [editing, setEditing] = useState<{ index: number; isNew: boolean } | null>(null);
  // Snapshot taken when an existing row enters edit mode, restored on cancel.
  const [snapshot, setSnapshot] = useState<BankAccountFormValues | null>(null);
  // Which field of the account being edited the operator is in. The preview
  // card rings that region. Not cleared on blur: the ring following the caret
  // is the point, and a card that empties between fields flickers.
  const [focusField, setFocusField] = useState<BankAccountField | null>(null);
  const form = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: { displayName: '', accounts: [] },
  });
  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'accounts',
  });

  useEffect(() => {
    if (config !== null) {
      form.reset({ displayName: config.displayName ?? '', accounts: config.accounts ?? [] });
      setError('');
      setEditing(null);
      setSnapshot(null);
      setFocusField(null);
    }
  }, [config, form]);

  const isSubmitting = form.formState.isSubmitting;
  const showAccounts = config?.method === 'bank_transfer';

  function handleOpenChange(nextOpen: boolean): void {
    if (!nextOpen) setError('');
    onOpenChange(nextOpen);
  }

  function handleAddAccount(): void {
    append(EMPTY_ACCOUNT);
    setEditing({ index: fields.length, isNew: true });
    setFocusField(null);
  }

  function handleEditAccount(index: number): void {
    setSnapshot(form.getValues(`accounts.${index}`));
    setEditing({ index, isNew: false });
    setFocusField(null);
  }

  function handleCancelAccount(): void {
    if (editing === null) return;
    if (editing.isNew) {
      remove(editing.index);
    } else if (snapshot !== null) {
      update(editing.index, snapshot);
    }
    setEditing(null);
    setSnapshot(null);
    setFocusField(null);
  }

  async function handleSaveAccount(): Promise<void> {
    if (editing === null) return;
    const valid = await form.trigger(`accounts.${editing.index}`);
    if (!valid) return;
    setEditing(null);
    setSnapshot(null);
    setFocusField(null);
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
        setError(
          'Agregá al menos una cuenta bancaria antes de habilitar la transferencia bancaria.'
        );
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

        <form
          onSubmit={(e) => void form.handleSubmit(handleSubmit)(e)}
          noValidate
          className="space-y-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="method-display-name">Nombre visible</Label>
            <Input
              id="method-display-name"
              disabled={isSubmitting}
              aria-invalid={form.formState.errors.displayName !== undefined}
              aria-describedby={
                form.formState.errors.displayName !== undefined
                  ? 'method-display-name-error'
                  : undefined
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
                  onClick={handleAddAccount}
                  disabled={isSubmitting || editing !== null}
                >
                  Agregar cuenta
                </Button>
              </div>

              {fields.length === 0 && editing === null && (
                <p className="text-muted-foreground text-xs">
                  Todavía no hay cuentas bancarias configuradas.
                </p>
              )}

              {/* table-fixed is what makes the truncate on the cells work at all:
                  in an auto-layout table a cell grows to its content, so a long
                  account number pushed the table past the container and
                  overflow-hidden simply clipped it. */}
              {fields.some((_, index) => editing?.index !== index) && (
                <DataTable
                  caption="Cuentas bancarias configuradas"
                  tableClassName="table-fixed"
                  // Emptiness is decided above, and it is a different question:
                  // "no accounts configured" is not the same as "the only account
                  // is currently open in the edit panel", which also shows no rows.
                  isEmpty={false}
                  head={
                    <>
                      <Th>Banco</Th>
                      <Th width="w-24">Tipo</Th>
                      <Th>Número de cuenta</Th>
                      <Th>Titular</Th>
                      <Th width="w-24" align="right">
                        <span className="sr-only">Acciones</span>
                      </Th>
                    </>
                  }
                >
                      {fields.map((field, index) => {
                        if (editing?.index === index) return null;
                        const account = form.getValues(`accounts.${index}`);
                        return (
                          <Tr key={field.id}>
                            <Td className="truncate" title={account.bankName}>
                              {account.bankName}
                            </Td>
                            <Td>{accountTypeLabel(account.accountType)}</Td>
                            <Td className="truncate" title={account.accountNumber}>
                              {account.accountNumber}
                            </Td>
                            <Td className="truncate" title={account.accountHolder}>
                              {account.accountHolder}
                            </Td>
                            <Td align="right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost-warning"
                                  size="icon-sm"
                                  onClick={() => {
                                    handleEditAccount(index);
                                  }}
                                  aria-label={`Editar cuenta de ${account.bankName}`}
                                  disabled={isSubmitting || editing !== null}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost-destructive"
                                  size="icon-sm"
                                  onClick={() => {
                                    remove(index);
                                  }}
                                  aria-label={`Eliminar cuenta de ${account.bankName}`}
                                  disabled={isSubmitting || editing !== null}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </Td>
                          </Tr>
                        );
                      })}
                </DataTable>
              )}

              {editing !== null && (
                <div className="border-border bg-muted/30 space-y-3 rounded-lg border p-3">
                  <div className="flex justify-center">
                    <BankAccountCard
                      size="compact"
                      revealable={false}
                      highlight={focusField}
                      labels={BANK_ACCOUNT_CARD_LABELS}
                      bankName={form.watch(`accounts.${editing.index}.bankName`) || 'Banco'}
                      accountNumber={
                        form.watch(`accounts.${editing.index}.accountNumber`) || '····'
                      }
                      accountHolder={
                        form.watch(`accounts.${editing.index}.accountHolder`) || 'Titular'
                      }
                      accountType={form.watch(`accounts.${editing.index}.accountType`)}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`account-${editing.index}-bankName`}>Banco</Label>
                      <Input
                        id={`account-${editing.index}-bankName`}
                        disabled={isSubmitting}
                        aria-invalid={
                          form.formState.errors.accounts?.[editing.index]?.bankName !== undefined
                        }
                        aria-describedby={
                          form.formState.errors.accounts?.[editing.index]?.bankName !== undefined
                            ? `account-${editing.index}-bankName-error`
                            : undefined
                        }
                        {...form.register(`accounts.${editing.index}.bankName`)}
                        onFocus={() => {
                          setFocusField('bankName');
                        }}
                      />
                      {form.formState.errors.accounts?.[editing.index]?.bankName !== undefined && (
                        <p
                          id={`account-${editing.index}-bankName-error`}
                          role="alert"
                          className="text-destructive text-xs"
                        >
                          {form.formState.errors.accounts[editing.index]?.bankName?.message}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`account-${editing.index}-accountType`}>Tipo de cuenta</Label>
                      <Select
                        value={form.watch(`accounts.${editing.index}.accountType`)}
                        onValueChange={(value) => {
                          form.setValue(
                            `accounts.${editing.index}.accountType`,
                            value as 'checking' | 'savings',
                            {
                              shouldValidate: true,
                            }
                          );
                        }}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger
                          id={`account-${editing.index}-accountType`}
                          onFocus={() => {
                            setFocusField('accountType');
                          }}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="checking">Cuenta corriente</SelectItem>
                          <SelectItem value="savings">Caja de ahorro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`account-${editing.index}-accountNumber`}>
                        Número de cuenta
                      </Label>
                      <Input
                        id={`account-${editing.index}-accountNumber`}
                        disabled={isSubmitting}
                        aria-invalid={
                          form.formState.errors.accounts?.[editing.index]?.accountNumber !==
                          undefined
                        }
                        aria-describedby={
                          form.formState.errors.accounts?.[editing.index]?.accountNumber !==
                          undefined
                            ? `account-${editing.index}-accountNumber-error`
                            : undefined
                        }
                        {...form.register(`accounts.${editing.index}.accountNumber`)}
                        onFocus={() => {
                          setFocusField('accountNumber');
                        }}
                      />
                      {form.formState.errors.accounts?.[editing.index]?.accountNumber !==
                        undefined && (
                        <p
                          id={`account-${editing.index}-accountNumber-error`}
                          role="alert"
                          className="text-destructive text-xs"
                        >
                          {form.formState.errors.accounts[editing.index]?.accountNumber?.message}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`account-${editing.index}-accountHolder`}>Titular</Label>
                      <Input
                        id={`account-${editing.index}-accountHolder`}
                        disabled={isSubmitting}
                        aria-invalid={
                          form.formState.errors.accounts?.[editing.index]?.accountHolder !==
                          undefined
                        }
                        aria-describedby={
                          form.formState.errors.accounts?.[editing.index]?.accountHolder !==
                          undefined
                            ? `account-${editing.index}-accountHolder-error`
                            : undefined
                        }
                        {...form.register(`accounts.${editing.index}.accountHolder`)}
                        onFocus={() => {
                          setFocusField('accountHolder');
                        }}
                      />
                      {form.formState.errors.accounts?.[editing.index]?.accountHolder !==
                        undefined && (
                        <p
                          id={`account-${editing.index}-accountHolder-error`}
                          role="alert"
                          className="text-destructive text-xs"
                        >
                          {form.formState.errors.accounts[editing.index]?.accountHolder?.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCancelAccount}
                      disabled={isSubmitting}
                    >
                      Cancelar cuenta
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        void handleSaveAccount();
                      }}
                      disabled={isSubmitting}
                    >
                      Guardar cuenta
                    </Button>
                  </div>
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
            <Button type="submit" disabled={isSubmitting || editing !== null}>
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
        toast.error(
          'Agregá al menos una cuenta bancaria antes de habilitar la transferencia bancaria.'
        );
      } else {
        toast.error(
          err instanceof ApiError ? err.message : 'No se pudo actualizar el método de pago'
        );
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
              <div key={config.method} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label htmlFor={`method-${config.method}`} className="font-medium">
                      {config.displayName ?? METHOD_LABELS[config.method]}
                    </Label>
                    {config.method === 'bank_transfer' && accountCount === 0 && (
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Todavía no hay cuentas bancarias configuradas.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="ghost-warning"
                      size="icon-sm"
                      onClick={() => {
                        setEditingConfig(config);
                      }}
                      aria-label={`Editar ${config.displayName ?? METHOD_LABELS[config.method]}`}
                    >
                      <Pencil className="h-4 w-4" />
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

                {config.method === 'bank_transfer' && accountCount > 0 && (
                  <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                    {config.accounts?.map((account) => (
                      <li key={`${account.bankName}-${account.accountNumber}`}>
                        <BankAccountCard
                          bankName={account.bankName}
                          accountNumber={account.accountNumber}
                          accountHolder={account.accountHolder}
                          accountType={account.accountType}
                          size="compact"
                          labels={BANK_ACCOUNT_CARD_LABELS}
                        />
                      </li>
                    ))}
                  </ul>
                )}
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
