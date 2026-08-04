'use client';

import { Button } from '@core/ui';
import { ArrowLeft, ArrowRight, type LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type JSX, type ReactNode } from 'react';

import { prevStep, type Step } from '../state/wizard-machine';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StepHeaderProps {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  currentStep: Step;
  draftId: string;
  /** When undefined the continue button is hidden (step not ready to advance). */
  onContinue?: (() => void) | undefined;
  isSubmitting?: boolean | undefined;
  continueLabel?: string | undefined;
  continueLoadingLabel?: string | undefined;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Wizard step bar: back on the left corner, title centered, continue on the right.
 * Both side slots are `flex-1` so the title stays centered whatever the buttons hold.
 */
export function StepHeader({
  icon: Icon,
  title,
  description,
  currentStep,
  draftId,
  onContinue,
  isSubmitting = false,
  continueLabel = 'Continuar',
  continueLoadingLabel = 'Guardando...',
}: StepHeaderProps): JSX.Element {
  const router = useRouter();
  // 'plan' is the wizard entry point — product selection is reached from outside.
  const previous = currentStep === 'plan' ? null : prevStep(currentStep);

  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-1 justify-start">
        {previous !== null && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            aria-label="Atrás"
            className="px-4 sm:px-6"
            onClick={() => {
              router.push(`/signup/${draftId}/${previous}`);
            }}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Atrás</span>
          </Button>
        )}
      </div>

      <div className="flex min-w-0 flex-col items-center text-center">
        <div className="bg-primary/10 flex h-12 min-h-12 w-12 min-w-12 items-center justify-center rounded-2xl">
          <Icon className="text-primary h-6 w-6" aria-hidden="true" />
        </div>
        <h1
          id="step-heading"
          className="text-foreground mt-3 text-2xl font-bold tracking-tight"
          tabIndex={-1}
        >
          {title}
        </h1>
        <div className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{description}</div>
      </div>

      <div className="flex flex-1 justify-end">
        {onContinue !== undefined && (
          <Button
            type="button"
            variant="default"
            size="lg"
            aria-label={isSubmitting ? continueLoadingLabel : continueLabel}
            className="px-4 sm:px-6"
            onClick={() => {
              if (!isSubmitting) onContinue();
            }}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            <span className="hidden sm:inline">
              {isSubmitting ? continueLoadingLabel : continueLabel}
            </span>
            {isSubmitting ? (
              <div
                className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden="true"
              />
            ) : (
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
