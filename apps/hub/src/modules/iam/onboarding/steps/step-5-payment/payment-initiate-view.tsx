'use client';

import { DollarSign } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type JSX } from 'react';

import { StepHeader } from '../../components/step-header';
import { WizardNav } from '../../components/wizard-nav';
import { initiatePayment } from '../../services/draft.service';
import type { DraftState } from '../../services/draft.service';
import type { Plan } from '../../services/plans.service';
import { StepErrorBanner } from '../shared/step-error-banner';

import { ATTEMPT_STORAGE_KEY } from './use-payment-polling';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PaymentInitiateViewProps {
  draftId: string;
  plan: Plan | null;
  draft: DraftState;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PaymentInitiateView({
  draftId,
  plan,
  draft,
}: PaymentInitiateViewProps): JSX.Element {
  const router = useRouter();
  const [isInitiating, setIsInitiating] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // ─── Initiate payment handler ──────────────────────────────────────────────

  async function handleInitiatePayment(): Promise<void> {
    setInitError(null);
    setIsInitiating(true);

    try {
      const storedAttempt = localStorage.getItem(ATTEMPT_STORAGE_KEY(draftId));
      const attempt = storedAttempt !== null ? Number(storedAttempt) + 1 : 1;
      localStorage.setItem(ATTEMPT_STORAGE_KEY(draftId), String(attempt));

      const { redirectUrl } = await initiatePayment(draftId, attempt);
      try {
        const url = new URL(redirectUrl);
        if (url.origin === window.location.origin) {
          router.push(url.pathname + url.search);
        } else {
          window.location.assign(redirectUrl);
        }
      } catch {
        window.location.assign(redirectUrl);
      }
    } catch {
      setInitError('No se pudo iniciar el pago. Intenta de nuevo.');
      setIsInitiating(false);
    }
  }

  const priceFormatted = plan !== null ? new Intl.NumberFormat('es-PY').format(plan.price) : '—';

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
      <StepHeader
        icon={DollarSign}
        title="Pago"
        description="Completa tu pago para activar tu cuenta."
      />

      <StepErrorBanner message={initError} />

      {/* Summary panel */}
      <div className="border-border bg-muted/30 rounded-xl border p-6">
        <h2 className="text-foreground text-base font-semibold">Resumen del pedido</h2>
        <div className="border-border mt-4 flex items-center justify-between border-t pt-4">
          <span className="text-muted-foreground text-sm">
            {plan?.name ?? 'Plan'} · {plan?.billingCycle === 'monthly' ? 'mensual' : 'anual'}
          </span>
          <span className="text-foreground text-base font-bold">
            {priceFormatted} {plan?.currency}
          </span>
        </div>

        <div className="text-muted-foreground mt-2 text-xs">
          Empresa: {draft.company?.legalName}
        </div>
      </div>

      <WizardNav
        currentStep="payment"
        draftId={draftId}
        onContinue={() => void handleInitiatePayment()}
        isSubmitting={isInitiating}
        continueLabel="Pagar con Bancard"
        continueLoadingLabel="Redirigiendo..."
      />

      <p className="text-muted-foreground text-center text-xs">
        Serás redirigido al portal de pago seguro de Bancard.
      </p>
    </div>
  );
}
