'use client';

import { CheckCircle2, CheckIcon } from 'lucide-react';
import { type JSX, type ReactNode } from 'react';

import { GradientBorderCard } from '@/components';
import { type Plan } from '@/lib/api/plans';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PlanCardProps {
  plan: Plan;
  isSelected?: boolean | undefined;
  isSubmitting?: boolean | undefined;
  /** Omit to render a card that presents a plan rather than offering it. */
  onSelect?: ((plan: Plan) => void) | undefined;
  onShowDetails?: ((plan: Plan) => void) | undefined;
  /** Extra marker beside the name, e.g. "Plan actual". */
  badge?: ReactNode | undefined;
  /** Replaces the default "Ver detalles" link at the foot of the card. */
  footer?: ReactNode | undefined;
  /** Sizing owned by the collection (flex track), not by the card itself. */
  className?: string | undefined;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * One plan, rendered the same whether it is being chosen during registration or
 * shown afterwards as the plan in force.
 *
 * They used to be two components, and they disagreed on more than styling: the
 * signup card lists the modules the plan actually grants, while the billing one
 * listed `features`, a free-text marketing array. A customer compared plans on
 * one screen and then saw a different description of the same plan on the other.
 */
export function PlanCard({
  plan,
  isSelected = false,
  isSubmitting = false,
  onSelect,
  onShowDetails,
  badge,
  footer,
  className = '',
}: PlanCardProps): JSX.Element {
  const isSelectable = onSelect !== undefined;
  const priceFormatted = new Intl.NumberFormat('es-PY').format(plan.price);
  const cycleLabel = plan.billingCycle === 'monthly' ? '/mes' : '/año';
  const modules = plan.modules ?? [];

  return (
    <GradientBorderCard
      key={plan.id}
      isSelected={isSelected}
      popular={plan.popular}
      {...(isSelectable ? { onClick: () => { onSelect(plan); } } : {})}
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
          // Cursor — a card that presents a plan is not a control.
          !isSelectable ? '' : isSubmitting ? 'cursor-not-allowed' : 'cursor-pointer',
          // Transitions
          'transition-all duration-200',
          isSelectable && !isSubmitting ? 'hover:-translate-y-0.5 hover:shadow-md' : '',
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
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-foreground text-xl font-bold tracking-tight">{plan.name}</h2>
            {badge}
          </div>

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
        <div className="mt-auto">
          {footer ??
            (onShowDetails !== undefined && (
              <button
                type="button"
                className="text-primary self-start text-sm font-medium underline-offset-4 hover:underline"
                onClick={(event) => {
                  // The card itself selects the plan — opening details must not.
                  event.stopPropagation();
                  onShowDetails(plan);
                }}
              >
                Ver detalles
              </button>
            ))}
        </div>
      </article>
    </GradientBorderCard>
  );
}
