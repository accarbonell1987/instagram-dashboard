'use client';

import { Badge, Button } from '@core/ui';
import type { JSX } from 'react';

import type { Plan } from '@/lib/api/plans';
import { PlanCard } from '@/modules/shared/billing/components/plan-card';

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface CurrentPlanCardProps {
  plan: Plan | null;
  isLoading?: boolean | undefined;
  onChangePlan: () => void;
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function CardSkeleton(): JSX.Element {
  return (
    <div
      className="border-border bg-card flex flex-col gap-6 rounded-2xl border p-8"
      aria-busy="true"
      aria-label="Cargando el plan contratado"
    >
      <div className="bg-muted h-6 w-32 animate-pulse rounded" />
      <div className="bg-muted h-10 w-40 animate-pulse rounded" />
      <div className="border-border border-t" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-muted h-4 w-full animate-pulse rounded" />
        ))}
      </div>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * The plan in force, drawn with the same card the customer chose it from.
 *
 * It used to be its own component with its own layout, and it described the
 * plan differently: signup lists the modules the plan grants, this listed
 * `features`, a free-text array. Comparing plans and then checking which one
 * you are on showed two different accounts of the same thing.
 */
export function CurrentPlanCard({
  plan,
  isLoading = false,
  onChangePlan,
}: CurrentPlanCardProps): JSX.Element {
  if (isLoading || plan === null) {
    return <CardSkeleton />;
  }

  return (
    <PlanCard
      plan={plan}
      // Marked as chosen: this is the plan in force, and the card already has a
      // visual language for that. It is not selectable — omitting onSelect is
      // what makes it a presentation rather than a control.
      isSelected
      badge={
        <Badge variant="outline" className="text-xs">
          Plan actual
        </Badge>
      }
      footer={
        <Button variant="outline" onClick={onChangePlan} className="w-full sm:w-auto">
          Cambiar plan
        </Button>
      }
      className="max-w-md"
    />
  );
}
