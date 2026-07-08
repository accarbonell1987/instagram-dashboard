'use client';

import { useQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type JSX } from 'react';

import { StepHeader } from '../../components/step-header';
import { WizardNav } from '../../components/wizard-nav';
import { useDraftContext } from '../../context/draft-context';
import { patchDraft, resetDraftStepKey } from '../../services/draft.service';
import { listPlans, type Plan } from '../../services/plans.service';
import { StepErrorBanner } from '../shared/step-error-banner';

import { PlanCard } from './plan-card';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StepPlanSelectionProps {
  draftId: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StepPlanSelection({ draftId }: StepPlanSelectionProps): JSX.Element {
  const router = useRouter();
  const { draft, refresh } = useDraftContext();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(draft.plan?.id ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ['plans'],
    queryFn: listPlans,
    staleTime: 5 * 60 * 1000,
  });

  // Selecting a card only updates local UI state — no network call.
  function handleCardClick(plan: Plan): void {
    if (isSubmitting) return;
    setSelectedPlanId(plan.id);
    setError(null);
  }

  // "Continuar" is only available on the selected card. Clicking "Seleccionar"
  // on a non-selected card first selects it; the user must click again to save.
  async function handleContinue(plan: Plan): Promise<void> {
    if (plan.id !== selectedPlanId) {
      // First click on a non-selected card → just select it, don't save yet.
      setSelectedPlanId(plan.id);
      setError(null);
      return;
    }

    // Second click (card already selected) → save and navigate.
    setIsSubmitting(true);
    setError(null);

    try {
      // If the user is changing to a different plan than what was already saved,
      // the previous idempotency key is tied to a different request body — reset it
      // so the server doesn't reject with idempotency.key_reused.
      if (draft.plan !== null && draft.plan.id !== plan.id) {
        resetDraftStepKey(draftId, 'representative');
      }
      await patchDraft(draftId, 'representative', {
        planId: plan.id,
        version: draft.version,
      });
      refresh();
      router.push(`/signup/${draftId}/representative`);
    } catch {
      setError('No se pudo guardar el plan. Intenta de nuevo.');
      setIsSubmitting(false);
    }
  }

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-24">
        <div
          className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
          role="status"
          aria-label="Cargando planes..."
        />
      </div>
    );
  }

  const plans = data?.plans ?? [];

  return (
    <div className="flex flex-col gap-8">
      <StepHeader
        icon={Package}
        title="Elige tu plan"
        description="Puedes cambiar tu plan en cualquier momento."
      />

      <StepErrorBanner message={error} />

      {/* mt-6 + overflow-visible: creates space for the top badge on popular card */}
      <div
        className="mt-6 grid grid-cols-1 gap-6 overflow-visible sm:grid-cols-3"
        role="list"
        aria-labelledby="step-heading"
      >
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isSelected={selectedPlanId === plan.id}
            isSubmitting={isSubmitting}
            onSelect={handleCardClick}
          />
        ))}
      </div>

      <WizardNav
        currentStep="plan"
        draftId={draftId}
        onContinue={
          selectedPlanId !== null
            ? () => {
                const plan = plans.find((p) => p.id === selectedPlanId);
                if (plan) void handleContinue(plan);
              }
            : undefined
        }
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
