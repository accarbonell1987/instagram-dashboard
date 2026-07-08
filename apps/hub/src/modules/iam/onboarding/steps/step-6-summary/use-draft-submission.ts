'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { submitDraft } from '../../services/draft.service';
import { ConflictError } from '@/lib/api/errors';

import type { SummaryDocuments } from './summary-types';

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseDraftSubmissionResult {
  documents: SummaryDocuments | null;
  isLoading: boolean;
  loadError: string | null;
  conflictStep: 'company' | 'representative' | null;
  retry: () => void;
}

export function useDraftSubmission(
  draftId: string,
  initialDocuments: SummaryDocuments | undefined,
  draftStatus: string,
  draftVersion: number,
  onSubmitted?: () => void,
): UseDraftSubmissionResult {
  const [documents, setDocuments] = useState<SummaryDocuments | null>(initialDocuments ?? null);
  const [isLoading, setIsLoading] = useState(documents === null && draftStatus !== 'completed');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [conflictStep, setConflictStep] = useState<'company' | 'representative' | null>(null);
  const submitAttempted = useRef(false);
  // retryCount drives the effect re-run without adding documents/draftStatus as deps.
  const [retryCount, setRetryCount] = useState(0);

  const retry = useCallback(() => {
    submitAttempted.current = false;
    setLoadError(null);
    setConflictStep(null);
    setIsLoading(true);
    setRetryCount((count) => count + 1);
  }, []);

  useEffect(() => {
    if (documents !== null) return;
    if (draftStatus === 'completed') {
      setIsLoading(false);
      return;
    }
    if (submitAttempted.current) return;
    submitAttempted.current = true;

    setIsLoading(true);
    void submitDraft(draftId, draftVersion)
      .then((result) => {
        // Bug 9 fix: backend returns IDs; hub uses DocumentDownloadButton for on-demand URLs.
        // invoiceUrl/contractUrl are empty strings as fallback (never displayed when IDs present).
        setDocuments({
          invoiceId: result.documents.invoiceId,
          contractId: result.documents.contractId,
          invoiceUrl: '',
          contractUrl: '',
        });
        onSubmitted?.();
      })
      .catch((error: unknown) => {
        if (error instanceof ConflictError) {
          if (error.backendCode === 'onboarding.email_already_exists') {
            setLoadError(
              'El correo electrónico del representante ya está registrado en otra empresa.'
            );
            setConflictStep('representative');
            return;
          }
          if (error.backendCode === 'onboarding.ruc_already_exists') {
            setLoadError('El RUC ingresado ya está registrado en otra empresa.');
            setConflictStep('company');
            return;
          }
        }
        setLoadError('No se pudo completar el registro. Contacta a soporte.');
        setConflictStep(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [retryCount]); // eslint-disable-line react-hooks/exhaustive-deps

  return { documents, isLoading, loadError, conflictStep, retry };
}
