'use client';

import { CheckCircle2, CheckIcon } from 'lucide-react';
import { type JSX } from 'react';

import { type Plan } from '../../services/plans.service';

import { GradientBorderCard } from '@/components';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PlanCardProps {
  plan: Plan;
  isSelected: boolean;
  isSubmitting: boolean;
  onSelect: (plan: Plan) => void;
  onShowDetails: (plan: Plan) => void;
  /** Sizing owned by the collection (flex track), not by the card itself. */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PlanCard({
  plan,
  isSelected,
  isSubmitting,
  onSelect,
  onShowDetails,
  className = '',
}: PlanCardProps): JSX.Element {
  const priceFormatted = new Intl.NumberFormat('es-PY').format(plan.price);
  const cycleLabel = plan.billingCycle === 'monthly' ? '/mes' : '/año';
  const modules = plan.modules ?? [];

  return (
    <GradientBorderCard
      key={plan.id}
      isSelected={isSelected}
      popular={plan.popular}
      onClick={() => {
        onSelect(plan);
      }}
      className={[className, isSelected ? '' : plan.popular ? 'scale-[1.02] shadow-xl' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <article
        role="article"
        aria-selected={isSelected}
        aria-disabled={isSubmitting && !isSelected}
        className={[
          // Base layout — NO border/ring when selected (GradientBorderCard handles it)
          'bg-card relative flex h-full flex-col gap-6 rounded-[calc(var(--radius-2xl)-2px)] p-8',
          // Cursor
          isSubmitting ? 'cursor-not-allowed' : 'cursor-pointer',
          // Transitions
          'transition-all duration-200',
          !isSubmitting ? 'hover:-translate-y-0.5 hover:shadow-md' : '',
          // Border — transparent when selected (gradient wrapper is the border)
          isSelected
            ? 'border border-transparent'
            : isSubmitting
              ? 'border-border border'
              : 'border-border hover:border-primary/50 border',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {plan.popular && (
          <div className="absolute right-4 top-4">
            <span className="bg-primary/15 text-primary rounded-full px-3 py-1 text-xs font-semibold">
              ✦ Más popular
            </span>
          </div>
        )}

        {isSelected && (
          <CheckCircle2 className="text-primary absolute left-3 top-3 h-5 w-5" aria-hidden="true" />
        )}

        {/* Plan name + price header */}
        <div className="flex flex-col gap-1">
          <h2 className="text-foreground text-xl font-bold tracking-tight">{plan.name}</h2>

          {plan.price === 0 ? (
            <p className="text-primary text-3xl font-bold">Gratis</p>
          ) : (
            <p className="text-foreground text-4xl font-extrabold">
              {priceFormatted}{' '}
              <span className="text-muted-foreground text-sm font-normal">
                {plan.currency}
                {cycleLabel}
              </span>
            </p>
          )}
        </div>

        {/* Visual separator between price and features */}
        <div className="border-border border-t" />

        {/* Module summary — the full tree with descriptions lives in the
            details dialog so the cards stay the same height and comparable. */}
        {modules.length > 0 && (
          <ul className="flex flex-col gap-3">
            {modules.map((module) => (
              <li
                key={module.id}
                className="text-foreground flex items-start gap-2 text-sm font-medium leading-snug"
              >
                <CheckIcon className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {module.name}
                  {module.subModules.length > 0 && (
                    <span className="text-muted-foreground font-normal">
                      {' '}
                      · {module.subModules.length}{' '}
                      {module.subModules.length === 1 ? 'funcionalidad' : 'funcionalidades'}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* mt-auto pins the action to the bottom whatever the module count */}
        <button
          type="button"
          className="text-primary mt-auto self-start text-sm font-medium underline-offset-4 hover:underline"
          onClick={(event) => {
            // The card itself selects the plan — opening details must not.
            event.stopPropagation();
            onShowDetails(plan);
          }}
        >
          Ver detalles
        </button>
      </article>
    </GradientBorderCard>
  );
}
