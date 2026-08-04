'use client';

import { use, type JSX } from 'react';

import { ProductSelectionStep } from '@/modules/iam/onboarding/steps/step-0-product-selection';
import { StepPlanSelection } from '@/modules/iam/onboarding/steps/step-1-plan-selection';
import { StepRepresentativeEmail } from '@/modules/iam/onboarding/steps/step-2-representative';
import { StepOtpVerification } from '@/modules/iam/onboarding/steps/step-3-otp';
import { StepCompanyData } from '@/modules/iam/onboarding/steps/step-4-company';
import { StepPayment } from '@/modules/iam/onboarding/steps/step-5-payment';
import { StepSummary } from '@/modules/iam/onboarding/steps/step-6-summary';

export default function WizardStepPage({
  params,
}: {
  params: Promise<{ draftId: string; step: string }>;
}): JSX.Element {
  const { draftId, step } = use(params);

  switch (step) {
    case 'product':
      return <ProductSelectionStep draftId={draftId} />;
    case 'plan':
      return <StepPlanSelection draftId={draftId} />;
    case 'representative':
      return <StepRepresentativeEmail draftId={draftId} />;
    case 'otp':
      return <StepOtpVerification draftId={draftId} />;
    case 'company':
      return <StepCompanyData draftId={draftId} />;
    case 'payment':
      return <StepPayment draftId={draftId} />;
    case 'summary':
      return <StepSummary draftId={draftId} />;
    default:
      return (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <h1 className="text-2xl font-semibold">Paso no encontrado</h1>
          <p className="text-muted-foreground">Redirigiendo...</p>
        </div>
      );
  }
}
