'use client';

import { Button } from '@core/ui';
import { useRouter } from 'next/navigation';
import { useState, type JSX } from 'react';

import { CopyButton } from '../../components/copy-button';
import { useDraftContext } from '../../context/draft-context';
import { recoverDraft } from '../../services/draft.service';

import type { StepSummaryProps } from './summary-types';
import { useDraftSubmission } from './use-draft-submission';

import { DocumentDownloadButton } from '@/modules/shared/billing/components/document-download-button';

// ─── Component ────────────────────────────────────────────────────────────────

export function StepSummary({
  draftId,
  documents: initialDocuments,
}: StepSummaryProps): JSX.Element {
  const router = useRouter();
  const { draft, refresh } = useDraftContext();
  const [isRecovering, setIsRecovering] = useState(false);

  const { documents, isLoading, loadError, conflictStep, retry } = useDraftSubmission(
    draftId,
    initialDocuments,
    draft.status,
    draft.version,
    refresh
  );

  async function handleRecoverAndEdit(targetStep: 'company' | 'representative'): Promise<void> {
    setIsRecovering(true);
    try {
      // The backend currently only supports recovering to 'company' step.
      // For 'representative' conflicts we also recover to 'company' — this clears the company
      // data and forces the wizard to stop at company step first (deriveCurrentStep detects
      // company === null). Full representative recovery will be added when backend supports it.
      const recoverStep = targetStep === 'company' ? 'company' : 'company';
      await recoverDraft(draftId, recoverStep);
      await refresh();
    } finally {
      setIsRecovering(false);
    }
  }

  function handleDownload(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
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
        <p className="text-muted-foreground mt-1 text-sm">
          Para acceder a la plataforma, activá tu cuenta desde el correo que te enviamos.
        </p>
      </div>

      {/* Activation email notice */}
      <div className="border-border bg-muted/30 w-full max-w-sm rounded-xl border p-6">
        <h2 className="text-muted-foreground mb-4 text-sm font-semibold uppercase tracking-wide">
          Activar cuenta
        </h2>
        <p className="text-muted-foreground mb-4 text-sm">
          Enviamos un enlace de activación a tu correo electrónico. Revisá tu bandeja de entrada y
          seguí las instrucciones para configurar tu contraseña.
        </p>
        <CopyButton
          url={`${globalThis.location?.origin ?? ''}/login`}
          label="Copiar enlace de acceso"
        />
      </div>

      {/* Document downloads */}
      {documents !== null && (
        <div className="border-border bg-muted/30 w-full max-w-sm rounded-xl border p-6">
          <h2 className="text-muted-foreground mb-4 text-sm font-semibold uppercase tracking-wide">
            Tus documentos
          </h2>

          <div className="flex flex-col gap-3">
            {documents.invoiceId !== undefined ? (
              <DocumentDownloadButton
                documentId={documents.invoiceId}
                label="Descargar Factura PDF"
              />
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  handleDownload(documents.invoiceUrl);
                }}
                className="w-full justify-between rounded-lg px-4 py-3 text-sm font-medium"
                aria-label="Descargar Factura PDF"
              >
                <span>Descargar Factura PDF</span>
                <span aria-hidden="true">↓</span>
              </Button>
            )}

            {documents.contractId !== undefined ? (
              <DocumentDownloadButton
                documentId={documents.contractId}
                label="Descargar Contrato PDF"
              />
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  handleDownload(documents.contractUrl);
                }}
                className="w-full justify-between rounded-lg px-4 py-3 text-sm font-medium"
                aria-label="Descargar Contrato PDF"
              >
                <span>Descargar Contrato PDF</span>
                <span aria-hidden="true">↓</span>
              </Button>
            )}
          </div>
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
