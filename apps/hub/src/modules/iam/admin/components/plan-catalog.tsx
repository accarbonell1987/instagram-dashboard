'use client';

import { Badge } from '@core/ui';
import { CheckCircle2, CheckIcon } from 'lucide-react';
import type { JSX } from 'react';

import type { components } from '@/lib/api/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Plan = components['schemas']['Plan'];

// ─── Props ─────────────────────────────────────────────────────────────────────

interface PlanCatalogProps {
  plans: Plan[];
  currentPlanId: string;
  selectedPlanId: string | null;
  onSelect: (planId: string) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const CURRENCY_SYMBOL: Record<Plan['currency'], string> = {
  PYG: 'Gs.',
  USD: 'USD',
};

// ─── Component ─────────────────────────────────────────────────────────────────

export function PlanCatalog({
  plans,
  currentPlanId,
  selectedPlanId,
  onSelect,
}: PlanCatalogProps): JSX.Element {
  if (plans.length === 0) {
    return <p className="text-muted-foreground py-4 text-sm">No hay planes disponibles.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {plans.map((plan) => {
        const isCurrent = plan.id === currentPlanId;
        const isSelected = plan.id === selectedPlanId;

        return (
          <div
            key={plan.id}
            className={[
              'relative rounded-lg border p-4 transition-all duration-150',
              isSelected
                ? 'border-primary bg-primary/5'
                : isCurrent
                  ? 'border-border bg-muted/40'
                  : 'border-border hover:border-primary/40 hover:bg-muted/20 cursor-pointer',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => {
              if (!isCurrent) onSelect(plan.id);
            }}
            role={isCurrent ? undefined : 'button'}
            tabIndex={isCurrent ? undefined : 0}
            onKeyDown={(e) => {
              if (!isCurrent && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onSelect(plan.id);
              }
            }}
          >
            {/* Selection indicator */}
            {isSelected && (
              <CheckCircle2
                className="text-primary absolute right-3 top-3 h-4 w-4"
                aria-hidden="true"
              />
            )}

            <div className="flex flex-col gap-2">
              {/* Name + badges */}
              <div className="flex items-center gap-2">
                <span className="text-foreground text-sm font-semibold">{plan.name}</span>
                {plan.popular && (
                  <span className="bg-primary/15 text-primary rounded-full px-2 py-0.5 text-xs font-semibold">
                    ✦ Popular
                  </span>
                )}
                {isCurrent && (
                  <Badge variant="outline" className="text-xs">
                    Plan actual
                  </Badge>
                )}
              </div>

              {/* Price */}
              <p className="text-foreground font-bold">
                {plan.price === 0 ? (
                  <span className="text-primary">Gratis</span>
                ) : (
                  <>
                    <span className="text-lg">
                      {CURRENCY_SYMBOL[plan.currency]} {plan.price.toLocaleString('es-PY')}
                    </span>
                    <span className="text-muted-foreground ml-1 text-xs font-normal">
                      / {plan.billingCycle === 'monthly' ? 'mes' : 'año'}
                    </span>
                  </>
                )}
              </p>

              {/* Features */}
              {plan.features.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="text-muted-foreground flex items-start gap-1.5 text-xs leading-snug"
                    >
                      <CheckIcon className="text-primary mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
