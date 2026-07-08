'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@core/ui';
import { type JSX, useEffect, useState } from 'react';

import {
  createDraft,
  resetCreateDraftKey,
} from '@/modules/iam/onboarding/services/draft.service';

export default function SignupEntryInner(): JSX.Element {
  const router = useRouter();
  const params = useSearchParams();
  const planId = params.get('plan') ?? undefined;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function initDraft(): Promise<void> {
      try {
        const { draftId, currentStep } = await createDraft({ planId, signal: controller.signal });
        // Reset the stable key so a future fresh visit to /signup?plan=X creates a new draft
        resetCreateDraftKey(planId);
        router.replace(`/signup/${draftId}/${currentStep}`);
      } catch (err) {
        // Ignore aborts — cleanup fired before the request completed (Strict Mode or navigation)
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!controller.signal.aborted) {
          setError('No se pudo iniciar el registro. Intenta de nuevo.');
        }
      }
    }

    void initDraft();

    return () => {
      controller.abort();
    };
  }, [planId, router]);

  if (error !== null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-foreground text-xl font-semibold">Error al iniciar</h1>
        <p className="text-muted-foreground">{error}</p>
        <Button
          type="button"
          variant="default"
          onClick={() => {
            setError(null);
            window.location.reload();
          }}
          className="rounded-lg px-6 py-2.5 text-sm font-semibold"
        >
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div
        className="border-primary h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
        role="status"
        aria-label="Iniciando registro..."
      />
    </div>
  );
}
