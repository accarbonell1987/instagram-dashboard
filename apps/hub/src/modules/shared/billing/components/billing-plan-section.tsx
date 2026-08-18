'use client';

import { useEffect, useState, type JSX } from 'react';

import { listPlans } from '@/lib/api/plans';
import type { components } from '@/lib/api/types';
import { CurrentPlanCard } from '@/modules/iam/admin/components/current-plan-card';
import { PlanChangeRequestDialog } from '@/modules/iam/admin/components/plan-change-request-dialog';
import { getCurrentTenant } from '@/modules/iam/admin/services/organization.service';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Tenant = components['schemas']['Tenant'];
type Plan = components['schemas']['Plan'];

// ─── Component ─────────────────────────────────────────────────────────────────

export function BillingPlanSection(): JSX.Element {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [planChangeOpen, setPlanChangeOpen] = useState(false);

  useEffect(() => {
    void Promise.allSettled([getCurrentTenant(), listPlans()]).then(
      ([tenantResult, plansResult]) => {
        if (tenantResult.status === 'fulfilled') {
          setTenant(tenantResult.value);
        }
        if (plansResult.status === 'fulfilled') {
          setPlans(plansResult.value.plans);
        }
        setIsLoading(false);
      }
    );
  }, []);

  const currentPlan = plans.find((p) => p.id === tenant?.planId) ?? null;

  return (
    <section className="flex flex-col gap-3">
      {/* The heading lives here, not inside the card: the card is the same one
          the customer picked their plan from during signup, and wrapping it in
          a second bordered panel would box a box. */}
      <h3 className="text-foreground text-lg font-medium">Plan contratado</h3>
      <CurrentPlanCard
        plan={currentPlan}
        isLoading={isLoading}
        onChangePlan={() => { setPlanChangeOpen(true); }}
      />
      <PlanChangeRequestDialog
        open={planChangeOpen}
        onOpenChange={setPlanChangeOpen}
        plans={plans}
        currentPlanId={tenant?.planId ?? ''}
      />
    </section>
  );
}
