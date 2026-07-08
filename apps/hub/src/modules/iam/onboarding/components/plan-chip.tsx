'use client';

import type { JSX } from 'react';

import { Button } from '@core/ui';
import type { Plan } from '../services/plans.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanChipProps {
  plan: Plan | null;
  onChange: () => void;
  variant?: 'top' | 'bottom';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PlanChip({ plan, onChange, variant = 'top' }: PlanChipProps): JSX.Element | null {
  if (plan === null) return null;

  const cycleLabel = plan.billingCycle === 'monthly' ? 'mensual' : 'anual';

  const priceFormatted = new Intl.NumberFormat('es-PY').format(plan.price);

  return (
    <div
      className={
        variant === 'bottom'
          ? 'fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t border-border bg-background px-4 py-3 shadow-lg md:hidden'
          : 'hidden rounded-xl border border-border bg-muted/50 px-4 py-3 md:flex md:items-center md:justify-between'
      }
      aria-label={`Plan seleccionado: ${plan.name}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Plan
        </span>
        <span className="font-semibold text-foreground">{plan.name}</span>
        <span className="text-sm text-muted-foreground">
          {priceFormatted} {plan.currency}/{cycleLabel}
        </span>
      </div>

      <Button
        type="button"
        variant="link"
        onClick={onChange}
        className="ml-4 text-sm font-medium"
      >
        Cambiar
      </Button>
    </div>
  );
}
