'use client';

import { Label, RadioGroup, RadioGroupItem } from '@core/ui';
import { DollarSign } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, type JSX } from 'react';

import { StepHeader } from '../../components/step-header';
import { initiatePayment, listPaymentMethods } from '../../services/draft.service';
import type { DraftState } from '../../services/draft.service';
import type { Plan } from '../../services/plans.service';
import { StepErrorBanner } from '../shared/step-error-banner';

import {
  getBankTransferInstruction,
  storeBankTransferInstruction,
} from './bank-transfer-storage';
import { BankTransferView } from './bank-transfer-view';
import { ATTEMPT_STORAGE_KEY } from './use-payment-polling';

import type { components } from '@/lib/api/types';

type BankTransferInstruction = components['schemas']['BankTransferPaymentInstruction'];
type PaymentMethodOption = components['schemas']['PaymentMethodOption'];
type PaymentMethodKind = components['schemas']['PaymentMethodKind'];

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
  const [bankTransfer, setBankTransfer] = useState<BankTransferInstruction | null>(null);
  const [methods, setMethods] = useState<PaymentMethodOption[] | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodKind | null>(null);

  // The backend is the source of truth (GET /onboarding/draft/{draftId} now
  // carries the instruction for an unsettled bank-transfer payment) —
  // localStorage is only a same-device fallback for a draft fetched before
  // this field existed, or an offline blip.
  useEffect(() => {
    setBankTransfer(draft.payment?.instruction ?? getBankTransferInstruction(draftId));
  }, [draftId, draft.payment?.instruction]);

  // One enabled method → use it directly, no picker. 2+ → wait for the user
  // to choose via the RadioGroup below (onContinue stays disabled until then).
  useEffect(() => {
    let cancelled = false;
    void listPaymentMethods().then((items) => {
      if (cancelled) return;
      setMethods(items);
      if (items.length === 1) {
        setSelectedMethod(items[0]?.method ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Initiate payment handler ──────────────────────────────────────────────

  async function handleInitiatePayment(): Promise<void> {
    setInitError(null);
    setIsInitiating(true);

    try {
      const storedAttempt = localStorage.getItem(ATTEMPT_STORAGE_KEY(draftId));
      const attempt = storedAttempt !== null ? Number(storedAttempt) + 1 : 1;
      localStorage.setItem(ATTEMPT_STORAGE_KEY(draftId), String(attempt));

      const { instruction } = await initiatePayment(draftId, attempt, selectedMethod ?? undefined);

      if (instruction.kind === 'bank_transfer') {
        storeBankTransferInstruction(draftId, instruction);
        setBankTransfer(instruction);
        setIsInitiating(false);
        return;
      }

      try {
        const url = new URL(instruction.redirectUrl);
        if (url.origin === window.location.origin) {
          router.push(url.pathname + url.search);
        } else {
          window.location.assign(instruction.redirectUrl);
        }
      } catch {
        window.location.assign(instruction.redirectUrl);
      }
    } catch {
      setInitError('No se pudo iniciar el pago. Intenta de nuevo.');
      setIsInitiating(false);
    }
  }

  if (bankTransfer !== null) {
    return <BankTransferView draftId={draftId} plan={plan} instruction={bankTransfer} />;
  }

  const priceFormatted = plan !== null ? new Intl.NumberFormat('es-PY').format(plan.price) : '—';
  const showPicker = methods !== null && methods.length > 1;
  const canContinue = !showPicker || selectedMethod !== null;
  const continueLabel = showPicker || selectedMethod === 'bank_transfer' ? 'Continuar' : 'Pagar con Bancard';

  return (
    <div className="flex flex-col gap-8">
      <StepHeader
        icon={DollarSign}
        title="Pago"
        description="Completa tu pago para activar tu cuenta."
        currentStep="payment"
        draftId={draftId}
        onContinue={canContinue ? () => void handleInitiatePayment() : undefined}
        isSubmitting={isInitiating}
        continueLabel={continueLabel}
        continueLoadingLabel="Redirigiendo..."
      />

      <StepErrorBanner message={initError} className="mx-auto w-full max-w-lg" />

      {showPicker && methods !== null && (
        <div className="border-border bg-muted/30 mx-auto w-full max-w-lg rounded-xl border p-6">
          <h2 id="payment-method-picker-label" className="text-foreground mb-4 text-base font-semibold">
            Elegí cómo pagar
          </h2>
          <RadioGroup
            aria-labelledby="payment-method-picker-label"
            value={selectedMethod ?? undefined}
            onValueChange={(value) => setSelectedMethod(value as PaymentMethodKind)}
          >
            {methods.map((option) => (
              <div key={option.method} className="flex items-center gap-2">
                <RadioGroupItem value={option.method} id={`payment-method-${option.method}`} />
                <Label htmlFor={`payment-method-${option.method}`}>{option.displayName}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      )}

      {/* Summary panel */}
      <div className="border-border bg-muted/30 mx-auto w-full max-w-lg rounded-xl border p-6">
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

      {!showPicker && selectedMethod !== 'bank_transfer' && (
        <p className="text-muted-foreground text-center text-xs">
          Serás redirigido al portal de pago seguro de Bancard.
        </p>
      )}
    </div>
  );
}
