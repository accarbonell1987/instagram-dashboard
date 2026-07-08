'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { use, useEffect, type ReactNode, type JSX } from 'react';

import { Button } from '@core/ui';
import { PlanChip } from '@/modules/iam/onboarding/components/plan-chip';
import { ResumeLinkButton } from '@/modules/iam/onboarding/components/resume-link-button';
import { Stepper } from '@/modules/iam/onboarding/components/stepper';
import { DraftProvider } from '@/modules/iam/onboarding/context/draft-context';
import { getDraft } from '@/modules/iam/onboarding/services/draft.service';
import { deriveCurrentStep, STEPS } from '@/modules/iam/onboarding/state/wizard-machine';
import type { Step } from '@/modules/iam/onboarding/state/wizard-machine';

// ─── Component ────────────────────────────────────────────────────────────────

export default function WizardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ draftId: string; step: string }>;
}): JSX.Element {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { draftId, step } = use(params);

  const {
    data: draft,
    isPending,
    isFetching,
    isError,
  } = useQuery({
    queryKey: ['draft', draftId],
    queryFn: () => getDraft(draftId),
    staleTime: 0,
    retry: false,
  });

  // Redirect guard: if URL step doesn't match derived step, redirect to correct one.
  // Skip while fetching — stale cached data would cause premature back-redirects
  // (e.g. navigating to summary before the cache reflects payment.status=approved).
  useEffect(() => {
    if (draft === undefined || isFetching) return;

    if (draft.status === 'completed') {
      router.replace(`/signup/${draftId}/summary`);
      return;
    }

    const derivedStep = deriveCurrentStep(draft);
    const urlStep = step as Step;

    // Only redirect if the URL step is ahead of what's reachable
    if (!STEPS.includes(urlStep) || STEPS.indexOf(urlStep) > STEPS.indexOf(derivedStep)) {
      router.replace(`/signup/${draftId}/${derivedStep}`);
    }
  }, [draft, draftId, isFetching, router, step]);

  function refresh(): void {
    void queryClient.invalidateQueries({ queryKey: ['draft', draftId] });
  }

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div
          className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
          aria-label="Cargando..."
          role="status"
        />
      </div>
    );
  }

  if (isError || (draft as unknown) === undefined) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-semibold">Error al cargar el registro</h1>
        <p className="text-muted-foreground">Tu sesión de registro expiró o no fue encontrada.</p>
        <Button
          type="button"
          variant="default"
          onClick={() => {
            router.push('/signup');
          }}
          className="rounded-lg px-6 py-2 text-sm font-semibold"
        >
          Comenzar de nuevo
        </Button>
      </div>
    );
  }

  // Drive the stepper from the URL so back-navigation (e.g. "Cambiar plan")
  // correctly highlights the step the user is actually on, not the furthest
  // step derived from draft data (which is forward-only and would stay ahead).
  const currentStep = STEPS.includes(step as (typeof STEPS)[number])
    ? (step as (typeof STEPS)[number])
    : deriveCurrentStep(draft);
  const plan = draft.plan;

  return (
    <DraftProvider value={{ draft, plan, draftId, refresh }}>
      <div className="bg-background flex min-h-screen flex-col">
        {/* Header with stepper */}
        <header className="border-border border-b px-4 py-6 md:px-12">
          <div className="mx-auto max-w-5xl">
            <Stepper
              current={currentStep}
              draft={draft}
              draftId={draftId}
              onStepClick={(target) => {
                router.push(`/signup/${draftId}/${target}`);
              }}
            />
          </div>
        </header>

        {/* Plan chip — desktop top */}
        {plan !== null && (
          <div className="mx-auto w-full max-w-5xl px-4 pt-4 md:px-12">
            <PlanChip
              plan={plan}
              onChange={() => {
                router.push(`/signup/${draftId}/plan`);
              }}
              variant="top"
            />
          </div>
        )}

        {/* Step content */}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-12">{children}</main>

        {/* Resume link — shown when email is known, hidden on summary (draft completed) */}
        {draft.representative?.email !== undefined && currentStep !== 'summary' && (
          <div className="pb-4">
            <ResumeLinkButton
              draftId={draftId}
              representativeEmail={draft.representative.email}
            />
          </div>
        )}

        {/* Plan chip — mobile bottom */}
        {plan !== null && (
          <PlanChip
            plan={plan}
            onChange={() => {
              router.push(`/signup/${draftId}/plan`);
            }}
            variant="bottom"
          />
        )}
      </div>
    </DraftProvider>
  );
}
