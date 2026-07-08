'use client';

import { useRouter } from 'next/navigation';
import { type JSX } from 'react';

import { Button } from '@core/ui';
import { WizardNav } from '../../components/wizard-nav';

const POLL_MAX_SECONDS = 60;

export interface PaymentVerifyingViewProps {
  draftId: string;
  pollStatus: 'pending' | 'approved' | 'declined' | 'timeout' | null;
  pollSeconds: number;
  onRetry: () => void;
  onRetryVerification: () => void;
}

export function PaymentVerifyingView({
  draftId,
  pollStatus,
  pollSeconds,
  onRetry,
  onRetryVerification,
}: PaymentVerifyingViewProps): JSX.Element {
  const router = useRouter();

  if (pollStatus === 'declined') {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col items-center gap-6 py-12 text-center">
          <div className="text-4xl" aria-hidden="true">✗</div>
          <h1 className="text-foreground text-2xl font-bold">Pago rechazado</h1>
          <p className="text-muted-foreground">
            Tu pago fue rechazado. Verificá los datos de tu tarjeta e intentá de nuevo.
          </p>
          <Button type="button" variant="default" onClick={onRetry}
            className="rounded-lg px-6 py-2.5 text-sm font-semibold">
            Reintentar pago
          </Button>
        </div>
        <WizardNav currentStep="payment" draftId={draftId} />
      </div>
    );
  }

  if (pollStatus === 'timeout') {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col items-center gap-6 py-12 text-center">
          <div className="text-4xl" aria-hidden="true">⏱</div>
          <h1 className="text-foreground text-2xl font-bold">Verificación pendiente</h1>
          <p className="text-muted-foreground">
            No pudimos confirmar tu pago aún. Verificá tu correo o contactá a soporte.
          </p>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onRetryVerification}
              className="rounded-lg px-6 py-2.5 text-sm font-semibold">
              Reintentar verificación
            </Button>
            <Button type="button" variant="secondary" onClick={() => { router.push('/'); }}
              className="rounded-lg px-6 py-2.5 text-sm font-semibold">
              Ir al inicio
            </Button>
          </div>
        </div>
        <WizardNav currentStep="payment" draftId={draftId} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-center gap-6 py-12 text-center">
        <div className="border-primary h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
          role="status" aria-label="Verificando pago..." />
        <h1 className="text-foreground text-xl font-semibold">Verificando tu pago...</h1>
        <p className="text-muted-foreground text-sm">
          {pollSeconds < 10
            ? 'Confirmando con el proveedor de pagos...'
            : 'Esto puede tardar unos segundos más...'}
        </p>
        <div className="bg-muted h-2 w-64 overflow-hidden rounded-full">
          <div className="bg-primary h-full rounded-full transition-all duration-1000"
            style={{ width: `${String(Math.min((pollSeconds / POLL_MAX_SECONDS) * 100, 100))}%` }}
            aria-hidden="true" />
        </div>
      </div>
      <WizardNav currentStep="payment" draftId={draftId} />
    </div>
  );
}
