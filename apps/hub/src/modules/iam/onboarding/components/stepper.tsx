'use client';

import {
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  Package,
  ShieldCheck,
  User,
  type LucideIcon,
} from 'lucide-react';
import type { JSX } from 'react';

import type { DraftState } from '../services/draft.service';
import { STEPS, isStepReachable } from '../state/wizard-machine';
import type { Step } from '../state/wizard-machine';

export interface StepperProps {
  current: Step;
  draft: DraftState;
  draftId: string;
  onStepClick?: ((step: Step) => void) | undefined;
}

type StepStatus = 'pending' | 'current' | 'completed';

const STEP_LABELS: Record<Step, string> = {
  plan: 'Plan',
  representative: 'Representante',
  otp: 'Verificación',
  company: 'Empresa',
  payment: 'Pago',
  summary: 'Resumen',
};

const STEP_ICONS: Record<Step, LucideIcon> = {
  plan: Package,
  representative: User,
  otp: ShieldCheck,
  company: Building2,
  payment: CreditCard,
  summary: CheckCircle2,
};

export function Stepper({ current, draft, onStepClick }: StepperProps): JSX.Element {
  const currentIndex = STEPS.indexOf(current);
  const isTerminal = current === 'summary';

  function getStatus(step: Step): StepStatus {
    const stepIndex = STEPS.indexOf(step);
    if (stepIndex < currentIndex && isStepReachable(step, draft)) return 'completed';
    if (step === current) return 'current';
    return 'pending';
  }

  function isClickable(step: Step): boolean {
    if (isTerminal) return false;
    const stepIndex = STEPS.indexOf(step);
    if (stepIndex >= currentIndex) return false;
    return isStepReachable(step, draft);
  }

  const stepNumber = currentIndex + 1;

  return (
    <nav aria-label="Pasos del registro">
      <div className="flex items-center justify-between md:hidden">
        <span className="text-foreground text-sm font-medium">
          Paso {stepNumber}/{STEPS.length}
        </span>
        <div className="flex gap-1.5">
          {STEPS.map((step) => {
            const status = getStatus(step);
            const clickable = isClickable(step);
            return (
              <button
                key={step}
                type="button"
                disabled={!clickable}
                onClick={() => {
                  if (clickable && onStepClick) onStepClick(step);
                }}
                className={[
                  'rounded-full transition-all duration-200',
                  status === 'completed'
                    ? clickable
                      ? 'bg-primary hover:ring-primary/30 h-2 w-2 cursor-pointer hover:ring-2'
                      : 'bg-primary h-2 w-2'
                    : status === 'current'
                      ? 'bg-primary ring-primary/40 h-2.5 w-2.5 ring-2 ring-offset-1'
                      : 'bg-muted-foreground/30 h-2 w-2',
                ].join(' ')}
                aria-label={clickable ? `Ir a ${STEP_LABELS[step]}` : STEP_LABELS[step]}
              />
            );
          })}
        </div>
      </div>

      <ol className="hidden items-center md:flex" role="list">
        {STEPS.map((step, index) => {
          const status = getStatus(step);
          const isLast = index === STEPS.length - 1;
          const clickable = isClickable(step);

          return (
            <li
              key={step}
              role="listitem"
              aria-label={STEP_LABELS[step]}
              aria-current={status === 'current' ? 'step' : undefined}
              data-status={status}
              className={`flex items-center ${!isLast ? 'flex-1' : ''}`}
            >
              <button
                type="button"
                disabled={!clickable}
                onClick={() => {
                  if (clickable && onStepClick) onStepClick(step);
                }}
                className={`flex flex-col items-center gap-1 ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                aria-label={clickable ? `Ir a ${STEP_LABELS[step]}` : STEP_LABELS[step]}
                tabIndex={clickable ? 0 : -1}
              >
                {(() => {
                  const StepIcon = STEP_ICONS[step];
                  return (
                    <span
                      className={[
                        'flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200',
                        status === 'completed'
                          ? clickable
                            ? 'bg-primary text-primary-foreground hover:ring-primary/20 hover:ring-4'
                            : 'bg-primary text-primary-foreground'
                          : status === 'current'
                            ? 'bg-primary text-primary-foreground ring-primary/20 ring-4'
                            : 'bg-muted text-muted-foreground/60',
                      ].join(' ')}
                      aria-hidden="true"
                    >
                      {status === 'completed' ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <StepIcon className="h-4 w-4" />
                      )}
                    </span>
                  );
                })()}
                <span
                  className={`text-xs font-medium ${
                    status === 'current'
                      ? 'text-foreground'
                      : status === 'completed'
                        ? 'text-muted-foreground'
                        : 'text-muted-foreground/50'
                  }`}
                >
                  {STEP_LABELS[step]}
                </span>
              </button>
              {!isLast && (
                <div
                  className={`mx-2 h-0.5 flex-1 transition-colors duration-300 ${status === 'completed' ? 'bg-primary' : 'bg-muted'}`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
