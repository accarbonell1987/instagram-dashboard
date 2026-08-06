'use client';

import { Button } from '@core/ui';
import { useRouter } from 'next/navigation';
import { useState, useEffect, type JSX } from 'react';

import { CopyButton } from '../../components/copy-button';
import { useDraftContext } from '../../context/draft-context';
import { recoverDraft } from '../../services/draft.service';
import { getBankTransferInstruction } from '../step-5-payment/bank-transfer-storage';

import type { StepSummaryProps } from './summary-types';
import { useDraftSubmission } from './use-draft-submission';

import type { components } from '@/lib/api/types';

type BankTransferInstruction = components['schemas']['BankTransferPaymentInstruction'];

// ─── Component ────────────────────────────────────────────────────────────────

export function StepSummary({
  draftId,
  documents: initialDocuments,
}: StepSummaryProps): JSX.Element {
  const router = useRouter();
  const { draft, refresh } = useDraftContext();
  const [isRecovering, setIsRecovering] = useState(false);
  const [bankTransfer, setBankTransfer] = useState<BankTransferInstruction | null>(null);

  const { isLoading, loadError, conflictStep, retry } = useDraftSubmission(
    draftId,
    initialDocuments,
    draft.status,
    draft.version,
    refresh
  );

  // Many customers close the tab before actually transferring — repeat the
  // reference and accounts here since it's the last screen they'll see for a while.
  // The backend (draft.payment.instruction) is the source of truth; localStorage
  // is only a same-device fallback for a draft fetched before this field existed.
  useEffect(() => {
    if (draft.payment?.method === 'bank_transfer') {
      setBankTransfer(draft.payment.instruction ?? getBankTransferInstruction(draftId));
    }
  }, [draft.payment?.method, draft.payment?.instruction, draftId]);

  async function handleRecoverAndEdit(targetStep: 'company' | 'representative'): Promise<void> {
    setIsRecovering(true);
    try {
      // The backend currently only supports recovering to 'company' step.
      // For 'representative' conflicts we also recover to 'company' — this clears the company
      // data and forces the wizard to stop at company step first (deriveCurrentStep detects
      // company === null). Full representative recovery will be added when backend supports it.
      const recoverStep = targetStep === 'company' ? 'company' : 'company';
      await recoverDraft(draftId, recoverStep);
      refresh();
    } finally {
      setIsRecovering(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-6 py-12 text-center">
        <div
          className="border-primary h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
          role="status"
          aria-label="Completando registro..."
        />
        <p className="text-muted-foreground">Completando tu registro...</p>
      </div>
    );
  }

  if (loadError !== null) {
    // Conflict: RUC already registered — user must edit company data
    if (conflictStep === 'company') {
      return (
        <div className="flex flex-col items-center gap-6 py-12 text-center">
          <div role="alert" className="flex flex-col gap-2">
            <p className="text-destructive font-semibold">{loadError}</p>
            <p className="text-muted-foreground text-sm">
              Podés corregir los datos de empresa y volver a intentar.
            </p>
          </div>
          <Button
            variant="default"
            onClick={() => {
              void handleRecoverAndEdit('company');
            }}
            disabled={isRecovering}
          >
            {isRecovering ? 'Procesando...' : 'Editar datos de empresa'}
          </Button>
        </div>
      );
    }

    // Conflict: email already registered — user must edit representative data
    if (conflictStep === 'representative') {
      return (
        <div className="flex flex-col items-center gap-6 py-12 text-center">
          <div role="alert" className="flex flex-col gap-2">
            <p className="text-destructive font-semibold">{loadError}</p>
            <p className="text-muted-foreground text-sm">
              Podés corregir los datos del representante y volver a intentar.
            </p>
          </div>
          <Button
            variant="default"
            onClick={() => {
              void handleRecoverAndEdit('representative');
            }}
            disabled={isRecovering}
          >
            {isRecovering ? 'Procesando...' : 'Editar datos del representante'}
          </Button>
        </div>
      );
    }

    // Transient error (network, service down) — safe to retry as-is
    return (
      <div className="flex flex-col items-center gap-6 py-12 text-center">
        <div role="alert" className="flex flex-col gap-2">
          <p className="text-destructive font-semibold">No se pudo completar el registro.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="default" onClick={retry}>
            Reintentar
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              router.push('/login');
            }}
          >
            Volver al inicio
          </Button>
        </div>
      </div>
    );
  }

  const companyName = draft.company?.legalName ?? 'Tu empresa';
  // Settlement (activation email + invoice + receipt) runs synchronously for
  // Bancard, but only once an agent confirms a bank transfer — days later.
  const isSettled = draft.payment?.status === 'approved';

  return (
    <div className="flex flex-col items-center gap-8 py-8 text-center">
      {/* Success icon */}
      <div
        className="bg-primary/10 flex h-20 w-20 items-center justify-center rounded-full text-4xl"
        aria-hidden="true"
      >
        ✓
      </div>

      <div>
        <h1 className="text-foreground text-3xl font-bold">¡Registro completado!</h1>
        <p className="text-muted-foreground mt-3">
          <strong>{companyName}</strong> ya es parte de Corehub.
        </p>
        {isSettled ? (
          <p className="text-muted-foreground mt-1 text-sm">
            Para acceder a la plataforma, activá tu cuenta desde el correo que te enviamos.
          </p>
        ) : (
          <p className="text-muted-foreground mt-1 text-sm">
            En cuanto confirmemos tu pago te enviaremos un correo para activar tu cuenta.
          </p>
        )}
      </div>

      {/* Email delivery notice — documents are email-only, never downloadable here */}
      <div className="border-border bg-muted/30 w-full max-w-sm rounded-xl border p-6">
        <h2 className="text-muted-foreground mb-4 text-sm font-semibold uppercase tracking-wide">
          {isSettled ? 'Tus documentos' : 'Qué sigue'}
        </h2>
        <p className="text-muted-foreground mb-4 text-sm">
          {isSettled
            ? 'Te enviamos la confirmación del pago junto con la factura y el recibo por correo electrónico.'
            : 'Apenas confirmemos tu transferencia, te enviaremos por correo la confirmación, la factura y el recibo — junto con el enlace de activación.'}
        </p>
        <CopyButton
          url={
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- globalThis.location is undefined during SSR
            `${globalThis.location?.origin ?? ''}/login`
          }
          label="Copiar enlace de acceso"
        />
      </div>

      {/* Bank-transfer recap — many customers close the tab before transferring */}
      {bankTransfer !== null && (
        <div className="border-border bg-muted/30 w-full max-w-sm rounded-xl border p-6 text-left">
          <h2 className="text-muted-foreground mb-4 text-center text-sm font-semibold uppercase tracking-wide">
            Datos para tu transferencia
          </h2>
          <div className="border-border bg-background flex items-center gap-2 rounded-lg border px-4 py-3">
            <span className="text-foreground min-w-0 flex-1 select-all font-mono text-base font-bold tracking-wide">
              {bankTransfer.reference}
            </span>
          </div>
          <ul className="mt-4 flex flex-col gap-3">
            {bankTransfer.bankAccounts.map((account, index) => (
              <li key={index} className="border-border bg-background rounded-lg border p-3 text-sm">
                <p className="text-foreground font-semibold">{account.bankName}</p>
                <p className="text-muted-foreground select-all font-mono">{account.accountNumber}</p>
                <p className="text-muted-foreground">{account.accountHolder}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CTA — redirects to login (not portal).
          The user MUST activate their account via email (first-login flow)
          before accessing the platform. This button replaces the previous
          "Ir a la plataforma" that bypassed the first-login requirement. */}
      <Button
        variant="outline"
        onClick={() => {
          router.push('/login');
        }}
      >
        Ir al inicio de sesión
      </Button>

      <p className="text-muted-foreground text-xs">
        También recibirás los documentos en tu correo electrónico.
      </p>
    </div>
  );
}
