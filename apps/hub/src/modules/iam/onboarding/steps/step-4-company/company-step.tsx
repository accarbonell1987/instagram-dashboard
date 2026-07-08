'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Building } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type JSX } from 'react';
import { useForm } from 'react-hook-form';

import { StepHeader } from '../../components/step-header';
import { WizardNav } from '../../components/wizard-nav';
import { useDraftContext } from '../../context/draft-context';
import { patchDraft } from '../../services/draft.service';
import { StepErrorBanner } from '../shared/step-error-banner';

import { CompanyFormFields } from './company-form-fields';
import { companySchema, type CompanyFields } from './company-schema';

import { ConflictError } from '@/lib/api/errors';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StepCompanyDataProps {
  draftId: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StepCompanyData({ draftId }: StepCompanyDataProps): JSX.Element {
  const router = useRouter();
  const { draft, refresh } = useDraftContext();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const existing = draft.company;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CompanyFields>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      razonSocial: existing?.legalName ?? '',
      ruc: existing?.ruc ?? '',
      tipoEmpresa: 'SA',
      direccionFiscal: existing?.address ?? '',
      ciudad: existing?.city ?? '',
      departamento: 'Central',
      telefono: draft.representative?.phone ?? '',
      personaContacto: draft.representative?.fullName ?? '',
      cargoContacto: '',
      sitioWeb: '',
    },
  });

  async function onSubmit(data: CompanyFields): Promise<void> {
    setSubmitError(null);

    try {
      await patchDraft(draftId, 'company', {
        company: {
          legalName: data.razonSocial,
          ruc: data.ruc,
          address: `${data.direccionFiscal}, ${data.departamento}`,
          city: data.ciudad,
          country: 'PY',
        },
        version: draft.version,
      });

      refresh();
      router.push(`/signup/${draftId}/payment`);
    } catch (err) {
      if (err instanceof ConflictError && err.backendCode === 'onboarding.ruc_already_exists') {
        setSubmitError('Este RUC ya está registrado. Verificá el número o contactá a soporte.');
      } else {
        setSubmitError('No se pudo guardar la información. Intenta de nuevo.');
      }
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <StepHeader
        icon={Building}
        title="Datos de la empresa"
        description="Información legal de tu empresa para el contrato de servicio."
      />

      <StepErrorBanner message={submitError} />

      <form
        role="form"
        aria-labelledby="step-heading"
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        noValidate
        className="grid grid-cols-1 gap-6 md:grid-cols-2"
      >
        <CompanyFormFields register={register} control={control} errors={errors} />

        <div className="md:col-span-2">
          <WizardNav
            currentStep="company"
            draftId={draftId}
            onContinue={handleSubmit(onSubmit)}
            isSubmitting={isSubmitting}
          />
        </div>
      </form>
    </div>
  );
}
