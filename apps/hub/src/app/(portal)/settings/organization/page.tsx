'use client';

import { useEffect, useState, type JSX } from 'react';

import { listPlans } from '@/lib/api/plans';
import type { components } from '@/lib/api/types';
import { OrganizationCard } from '@/modules/iam/admin/components/organization-card';
import { VisualStyleCard } from '@/modules/iam/admin/components/visual-style-card';
import {
  getCurrentTenant,
  updateTenantName as updateTenantNameApi,
} from '@/modules/iam/admin/services/organization.service';
import { RequireRole } from '@/modules/iam/identity/guards/require-role';
import { updateTenantName as updateTenantNameStore } from '@/modules/iam/identity/session/store';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Tenant = components['schemas']['Tenant'];

// ─── Component ─────────────────────────────────────────────────────────────────

export default function OrganizationPage(): JSX.Element {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void Promise.allSettled([getCurrentTenant(), listPlans()]).then(([tenantResult]) => {
      if (tenantResult.status === 'fulfilled') {
        setTenant(tenantResult.value);
      }

      setIsLoading(false);
    });
  }, []);

  async function handleSaveName(name: string): Promise<void> {
    await updateTenantNameApi(name);
    const refreshed = await getCurrentTenant();
    setTenant(refreshed);
    updateTenantNameStore(name);
  }

  return (
    <RequireRole role={['TenantAdmin', 'SuperAdmin']}>
      <div className="flex flex-col gap-6">
        <h2 className="text-foreground text-xl font-semibold">Organización</h2>
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <OrganizationCard tenant={tenant} isLoading={isLoading} onSaveName={handleSaveName} />
          <VisualStyleCard
            colorTheme={tenant?.colorTheme ?? null}
            isLoading={isLoading}
            onSaved={(colorTheme) => {
              setTenant((current) => (current === null ? current : { ...current, colorTheme }));
            }}
          />
        </div>
      </div>
    </RequireRole>
  );
}
