'use client';

import { Button } from '@core/ui';
import { CheckCircle2 } from 'lucide-react';
import { useEffect, useState, type JSX } from 'react';

import type { components } from '@/lib/api/types';
import { ConflictError } from '@/lib/api/errors';

import { getPaymentMethod, requestPaymentMethodChange } from '../services/billing.service';
import { PaymentMethodCard } from './payment-method-card';

// ─── Types ─────────────────────────────────────────────────────────────────────

type PaymentMethod = components['schemas']['PaymentMethod'];
type RequestState = 'idle' | 'loading' | 'success' | 'error';

// ─── Component ─────────────────────────────────────────────────────────────────

export function PaymentMethodSection(): JSX.Element {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [requestState, setRequestState] = useState<RequestState>('idle');
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    getPaymentMethod()
      .then((result) => {
        setPaymentMethod(result.paymentMethod);
      })
      .catch(() => {
        setLoadError('No pudimos cargar tu método de pago.');
      })
      .finally(() => {
        setIsLoadingData(false);
      });
  }, []);

  async function handleRequest(): Promise<void> {
    setRequestState('loading');
    setRequestError(null);
    try {
      await requestPaymentMethodChange();
      setRequestState('success');
    } catch (error: unknown) {
      if (error instanceof ConflictError) {
        setRequestError('Ya existe una solicitud pendiente.');
      } else {
        setRequestError('Error al enviar la solicitud. Intenta de nuevo.');
      }
      setRequestState('error');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {isLoadingData ? (
        <PaymentMethodCard isLoading={true} paymentMethod={null} />
      ) : loadError !== null ? (
        <div role="alert" className="text-destructive text-sm">
          {loadError} Intenta recargar la página.
        </div>
      ) : (
        <>
          <PaymentMethodCard isLoading={false} paymentMethod={paymentMethod} />
          <div className="mt-2">
            {requestState === 'success' ? (
              <div
                role="status"
                aria-live="polite"
                className="bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900/40 flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Solicitud recibida. Te contactaremos en las próximas 24 hs.</span>
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { void handleRequest(); }}
                  disabled={requestState === 'loading'}
                  aria-busy={requestState === 'loading' ? true : undefined}
                  className="w-full sm:w-auto"
                >
                  {requestState === 'loading'
                    ? 'Enviando…'
                    : paymentMethod !== null
                      ? 'Solicitar cambio de método de pago'
                      : 'Solicitar registro de método de pago'}
                </Button>
                {requestState === 'error' && requestError !== null && (
                  <p role="alert" className="text-destructive mt-2 text-sm">
                    {requestError}
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
