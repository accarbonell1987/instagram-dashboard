'use client';

import type { JSX } from 'react';

import { RequireRole } from '@/modules/iam/identity/guards/require-role';
import { BillingPlanSection } from '@/modules/shared/billing/components/billing-plan-section';
import { PaymentMethodSection } from '@/modules/shared/billing/components/payment-method-section';
import { InvoicesSection } from '@/modules/shared/billing/components/invoices-section';

export default function BillingPage(): JSX.Element {
  return (
    <RequireRole role={['TenantAdmin', 'SuperAdmin']}>
      <div className="flex flex-col gap-6">
        <h2 className="text-foreground text-xl font-semibold">Facturación</h2>
        <BillingPlanSection />
        <PaymentMethodSection />
        <InvoicesSection />
      </div>
    </RequireRole>
  );
}
