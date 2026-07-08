'use client';

import { useEffect, useState, type JSX } from 'react';

import type { components } from '@/lib/api/types';
import { CurrentPlanCard } from '@/modules/iam/admin/components/current-plan-card';
import { OrganizationCard } from '@/modules/iam/admin/components/organization-card';
import { PlanChangeRequestDialog } from '@/modules/iam/admin/components/plan-change-request-dialog';
import { listPlans } from '@/lib/api/plans';
import {
  getCurrentTenant,
  updateTenantName as updateTenantNameApi,
} from '@/modules/iam/admin/services/organization.service';
import { RequireRole } from '@/modules/iam/identity/guards/require-role';
import { updateTenantName as updateTenantNameStore } from '@/modules/iam/identity/session/store';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Tenant = components['schemas']['Tenant'];
type Plan = components['schemas']['Plan'];

// ─── Component ─────────────────────────────────────────────────────────────────

export default function OrganizationPage(): JSX.Element {
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

  async function handleSaveName(name: string): Promise<void> {
    await updateTenantNameApi(name);
    const refreshed = await getCurrentTenant();
    setTenant(refreshed);
    updateTenantNameStore(name);
  }

  const currentPlan = plans.find((p) => p.id === tenant?.planId) ?? null;

  return (
    <RequireRole role={['TenantAdmin', 'SuperAdmin']}>
      <div className="flex flex-col gap-6">
        <h2 className="text-foreground text-xl font-semibold">Organización</h2>
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <OrganizationCard
            tenant={tenant}
            isLoading={isLoading}
            onSaveName={handleSaveName}
          />
          <CurrentPlanCard
            plan={currentPlan}
            isLoading={isLoading}
            onChangePlan={() => { setPlanChangeOpen(true); }}
          />
        </div>
      </div>

      <PlanChangeRequestDialog
        open={planChangeOpen}
        onOpenChange={setPlanChangeOpen}
        plans={plans}
        currentPlanId={tenant?.planId ?? ''}
      />
    </RequireRole>
  );
}
