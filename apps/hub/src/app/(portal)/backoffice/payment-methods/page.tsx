'use client';

import { Label, Switch } from '@core/ui';
import { useCallback, useEffect, useState, type JSX } from 'react';
import { toast } from 'sonner';

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
  bank_transfer: 'Bank transfer',
};

const LAST_ENABLED_CODE = 'payment_method.last_enabled';

function isLastEnabledConflict(err: ConflictError): boolean {
  return err.backendCode === LAST_ENABLED_CODE || err.problem?.detail === LAST_ENABLED_CODE;
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PaymentMethodsPage(): JSX.Element {
  const [methods, setMethods] = useState<AdminPaymentMethodConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingMethod, setSavingMethod] = useState<PaymentMethodKind | null>(null);

  const loadMethods = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listPaymentMethods();
      setMethods(result.items);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Could not load payment methods');
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
      const updated = await updatePaymentMethod(method, enabled);
      setMethods((prev) => prev.map((m) => (m.method === method ? updated : m)));
      toast.success(`${METHOD_LABELS[method]} ${enabled ? 'enabled' : 'disabled'}`);
    } catch (err: unknown) {
      if (err instanceof ConflictError && isLastEnabledConflict(err)) {
        toast.error('At least one payment method must stay enabled.');
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Could not update the payment method');
      }
    } finally {
      setSavingMethod(null);
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Payment Methods</h2>

      {error !== '' && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-muted-foreground p-4 text-sm">Loading payment methods...</p>
      ) : (
        <div className="border-border divide-border bg-card divide-y rounded-lg border">
          {methods.map((config) => (
            <div key={config.method} className="flex items-center justify-between gap-4 p-4">
              <div>
                <Label htmlFor={`method-${config.method}`} className="font-medium">
                  {METHOD_LABELS[config.method]}
                </Label>
                {config.method === 'bank_transfer' && (
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Bank account details cannot be edited here yet — toggling only.
                  </p>
                )}
              </div>
              <Switch
                id={`method-${config.method}`}
                checked={config.enabled}
                disabled={savingMethod !== null}
                onCheckedChange={(checked) => {
                  void handleToggle(config.method, checked);
                }}
                aria-label={`${config.enabled ? 'Disable' : 'Enable'} ${METHOD_LABELS[config.method]}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
