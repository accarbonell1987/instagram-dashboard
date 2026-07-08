'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@core/ui';
import { CheckIcon } from 'lucide-react';
import type { JSX } from 'react';

import type { components } from '@/lib/api/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Plan = components['schemas']['Plan'];

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface CurrentPlanCardProps {
  plan: Plan | null;
  isLoading?: boolean;
  onChangePlan: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const CURRENCY_SYMBOL: Record<Plan['currency'], string> = {
  PYG: 'Gs.',
  USD: 'USD',
};

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function CardSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <div className="bg-muted h-5 w-32 animate-pulse rounded" />
      <div className="bg-muted h-7 w-24 animate-pulse rounded" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-muted h-3 w-full animate-pulse rounded" />
        ))}
      </div>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function CurrentPlanCard({
  plan,
  isLoading = false,
  onChangePlan,
}: CurrentPlanCardProps): JSX.Element {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Plan contratado</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-6">
        {isLoading || plan === null ? (
          <CardSkeleton />
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {/* Name + badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-foreground text-base font-semibold">{plan.name}</span>
                {plan.popular && (
                  <span className="bg-primary/15 text-primary rounded-full px-2 py-0.5 text-xs font-semibold">
                    ✦ Popular
                  </span>
                )}
                <Badge variant="outline" className="text-xs">
                  Plan actual
                </Badge>
              </div>

              {/* Price */}
              <p className="text-foreground font-bold">
                {plan.price === 0 ? (
                  <span className="text-primary text-lg">Gratis</span>
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
                <ul className="flex flex-col gap-1.5">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="text-muted-foreground flex items-start gap-1.5 text-xs leading-snug"
                    >
                      <CheckIcon
                        className="text-primary mt-0.5 h-3 w-3 shrink-0"
                        aria-hidden="true"
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-auto">
              <Button variant="outline" onClick={onChangePlan} className="w-full sm:w-auto">
                Cambiar plan
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
