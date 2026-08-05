'use client';

import { Button } from '@core/ui';
import { Check, Copy, Landmark } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useCallback, type JSX } from 'react';

import { StepHeader } from '../../components/step-header';
import type { Plan } from '../../services/plans.service';

import type { components } from '@/lib/api/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type BankTransferInstruction = components['schemas']['BankTransferPaymentInstruction'];

export interface BankTransferViewProps {
  draftId: string;
  plan: Plan | null;
  instruction: BankTransferInstruction;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BankTransferView({ draftId, plan, instruction }: BankTransferViewProps): JSX.Element {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const handleCopyReference = useCallback(() => {
    void navigator.clipboard.writeText(instruction.reference).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    });
  }, [instruction.reference]);

  const priceFormatted = plan !== null ? new Intl.NumberFormat('es-PY').format(plan.price) : '—';

  return (
    <div className="flex flex-col gap-8">
      <StepHeader
        icon={Landmark}
        title="Transferencia bancaria"
        description="Transferí el monto exacto e incluí la referencia. La confirmación puede tardar unos días hábiles."
        currentStep="payment"
        draftId={draftId}
        onContinue={() => {
          router.push(`/signup/${draftId}/summary`);
        }}
        continueLabel="Ya transferí"
      />

      <div className="border-border bg-muted/30 mx-auto w-full max-w-lg rounded-xl border p-6">
        <h2 className="text-muted-foreground mb-2 text-sm font-semibold uppercase tracking-wide">
          Referencia de la transferencia
        </h2>
        <p className="text-muted-foreground mb-3 text-sm">
          Incluí este código en el concepto/memo de la transferencia — es lo que usamos para
          identificar tu pago.
        </p>
        <div className="border-border bg-background flex items-center gap-2 rounded-lg border px-4 py-3">
          <span
            className="text-foreground min-w-0 flex-1 select-all font-mono text-lg font-bold tracking-wide"
            data-testid="transfer-reference"
          >
            {instruction.reference}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleCopyReference}
            aria-label={copied ? 'Referencia copiada' : 'Copiar referencia'}
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        <div className="border-border mt-4 flex items-center justify-between border-t pt-4">
          <span className="text-muted-foreground text-sm">
            {plan?.name ?? 'Plan'} · {plan?.billingCycle === 'monthly' ? 'mensual' : 'anual'}
          </span>
          <span className="text-foreground text-base font-bold">
            {priceFormatted} {plan?.currency}
          </span>
        </div>
      </div>

      <div className="border-border bg-muted/30 mx-auto w-full max-w-lg rounded-xl border p-6">
        <h2 className="text-muted-foreground mb-4 text-sm font-semibold uppercase tracking-wide">
          Cuentas para transferir
        </h2>
        <ul className="flex flex-col gap-4">
          {instruction.bankAccounts.map((account, index) => (
            <li key={index} className="border-border bg-background rounded-lg border p-4">
              <p className="text-foreground text-sm font-semibold">{account.bankName}</p>
              <dl className="text-muted-foreground mt-1 grid grid-cols-[auto_1fr] gap-x-2 text-sm">
                <dt>Tipo:</dt>
                <dd>{account.accountType === 'checking' ? 'Cuenta corriente' : 'Caja de ahorro'}</dd>
                <dt>Número:</dt>
                <dd className="select-all font-mono">{account.accountNumber}</dd>
                <dt>Titular:</dt>
                <dd>{account.accountHolder}</dd>
              </dl>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-muted-foreground text-center text-xs">
        No hace falta que esperes acá — podés continuar y te avisamos por correo apenas
        confirmemos tu pago.
      </p>
    </div>
  );
}
