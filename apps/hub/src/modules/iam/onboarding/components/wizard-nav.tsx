'use client';

import { Button } from '@core/ui';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type JSX } from 'react';

import { prevStep, type Step } from '../state/wizard-machine';

export interface WizardNavProps {
  currentStep: Step;
  draftId: string;
  onContinue?: (() => void) | undefined;
  isSubmitting?: boolean | undefined;
  continueLabel?: string | undefined;
  continueLoadingLabel?: string | undefined;
}

export function WizardNav({
  currentStep,
  draftId,
  onContinue,
  isSubmitting = false,
  continueLabel = 'Continuar',
  continueLoadingLabel = 'Guardando...',
}: WizardNavProps): JSX.Element | null {
  const router = useRouter();
  const showBack = currentStep !== 'plan';
  const showContinue = onContinue !== undefined;

  if (!showBack && !showContinue) return null;

  const previous = prevStep(currentStep);

  function handleBack(): void {
    if (previous !== null) {
      router.push(`/signup/${draftId}/${previous}`);
    }
  }

  return (
    <div className="flex items-center justify-between pt-6">
      <div>
        {showBack && previous !== null && (
          <Button type="button" variant="outline" size="lg" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Atrás
          </Button>
        )}
      </div>
      <div>
        {showContinue && (
          <Button
            type={isSubmitting ? 'button' : 'submit'}
            variant="default"
            size="lg"
            onClick={
              isSubmitting
                ? undefined
                : (e) => {
                    e.preventDefault();
                    onContinue();
                  }
            }
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <div
                  className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden="true"
                />
                {continueLoadingLabel}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                {continueLabel}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
