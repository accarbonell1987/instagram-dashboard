'use client';

import { Button } from '@core/ui';
import { Clock, Loader2, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type JSX } from 'react';

import { StepHeader } from '../../components/step-header';

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
        <StepHeader
          icon={XCircle}
          title="Pago rechazado"
          description="Tu pago fue rechazado. Verificá los datos de tu tarjeta e intentá de nuevo."
          currentStep="payment"
          draftId={draftId}
        />
        <div className="flex justify-center">
          <Button
            type="button"
            variant="default"
            onClick={onRetry}
            className="rounded-lg px-6 py-2.5 text-sm font-semibold"
          >
            Reintentar pago
          </Button>
        </div>
      </div>
    );
  }

  if (pollStatus === 'timeout') {
    return (
      <div className="flex flex-col gap-8">
        <StepHeader
          icon={Clock}
          title="Verificación pendiente"
          description="No pudimos confirmar tu pago aún. Verificá tu correo o contactá a soporte."
          currentStep="payment"
          draftId={draftId}
        />
        <div className="flex justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onRetryVerification}
            className="rounded-lg px-6 py-2.5 text-sm font-semibold"
          >
            Reintentar verificación
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              router.push('/');
            }}
            className="rounded-lg px-6 py-2.5 text-sm font-semibold"
          >
            Ir al inicio
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <StepHeader
        icon={Loader2}
        title="Verificando tu pago..."
        description={
          pollSeconds < 10
            ? 'Confirmando con el proveedor de pagos...'
            : 'Esto puede tardar unos segundos más...'
        }
        currentStep="payment"
        draftId={draftId}
      />
      <div className="flex flex-col items-center gap-6">
        <div
          className="border-primary h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
          role="status"
          aria-label="Verificando pago..."
        />
        <div className="bg-muted h-2 w-64 overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full transition-all duration-1000"
            style={{ width: `${String(Math.min((pollSeconds / POLL_MAX_SECONDS) * 100, 100))}%` }}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}
