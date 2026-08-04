'use client';

import { useQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type JSX } from 'react';

import { StepHeader } from '../../components/step-header';
import { useDraftContext } from '../../context/draft-context';
import { patchDraft, resetDraftStepKey } from '../../services/draft.service';
import { listPlans, type Plan } from '../../services/plans.service';
import { StepErrorBanner } from '../shared/step-error-banner';

import { PlanCard } from './plan-card';
import { PlanDetailsDialog } from './plan-details-dialog';

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
  const [detailsPlan, setDetailsPlan] = useState<Plan | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ['plans', draft.productId],
    queryFn: () => listPlans(draft.productId ?? undefined),
    staleTime: 5 * 60 * 1000,
  });

  // Pre-select the product's default plan (backoffice → Planes) once the list
  // arrives, unless the draft already carries a choice.
  useEffect(() => {
    if (selectedPlanId !== null) return;
    const defaultPlan = data?.plans.find((plan) => plan.isDefault === true);
    if (defaultPlan !== undefined) setSelectedPlanId(defaultPlan.id);
  }, [data, selectedPlanId]);

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

      <StepErrorBanner message={error} className="mx-auto w-full max-w-3xl" />

      {/* mt-6 + overflow-visible: creates space for the top badge on popular card.
          flex-wrap + basis: cards share one row and a lone card fills the width. */}
      <div
        className="mt-6 flex flex-wrap justify-center gap-6 overflow-visible"
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
            onShowDetails={setDetailsPlan}
            className="min-w-0 max-w-md flex-1 basis-72"
          />
        ))}
      </div>

      <PlanDetailsDialog
        plan={detailsPlan}
        onClose={() => {
          setDetailsPlan(null);
        }}
      />
    </div>
  );
}
