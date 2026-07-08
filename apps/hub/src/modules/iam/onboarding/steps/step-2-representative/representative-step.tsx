'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type JSX, useState } from 'react';
import { useForm } from 'react-hook-form';

import { StepHeader } from '../../components/step-header';
import { WizardNav } from '../../components/wizard-nav';
import { useDraftContext } from '../../context/draft-context';
import { patchDraft } from '../../services/draft.service';
import { StepErrorBanner } from '../shared/step-error-banner';

import { RepresentativeFormFields } from './representative-form-fields';
import { representativeSchema, type RepresentativeFields } from './representative-schema';

import { ConflictError, RateLimitError } from '@/lib/api/errors';
import { sendOtp } from '@/modules/iam/authentication/services/auth.service';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StepRepresentativeEmailProps {
  draftId: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StepRepresentativeEmail({ draftId }: StepRepresentativeEmailProps): JSX.Element {
  const router = useRouter();
  const { draft, refresh } = useDraftContext();
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Track whether patchDraft already succeeded in a previous attempt.
  // If sendOtp fails after a successful patch, the next retry skips the patch
  // (avoids 409 version_conflict since the draft already advanced).
  const [patchDone, setPatchDone] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RepresentativeFields>({
    resolver: zodResolver(representativeSchema),
    mode: 'onBlur',
    defaultValues: {
      email: draft.representative?.email ?? '',
      fullName: draft.representative?.fullName ?? '',
      phone: draft.representative?.phone ?? '',
    },
  });

  async function onSubmit(data: RepresentativeFields): Promise<void> {
    setSubmitError(null);

    try {
      // Step 1: patch draft — skip if already done in a previous attempt
      if (!patchDone) {
        await patchDraft(draftId, 'representative', {
          representative: {
            email: data.email,
            fullName: data.fullName,
            phone: data.phone,
          },
          version: draft.version,
        });
        setPatchDone(true);
      }

      // Step 2: send OTP — pass otpId via URL so OTP step doesn't re-send
      const { otpId } = await sendOtp({
        channel: 'email',
        purpose: 'signup-rep',
        identifier: data.email,
      });

      // Refresh draft state (version bumped by patchDraft) then navigate
      await refresh();
      router.push(`/signup/${draftId}/otp?otpId=${otpId}`);
    } catch (err) {
      if (err instanceof ConflictError && err.backendCode === 'onboarding.email_already_exists') {
        setSubmitError(
          'Este correo electrónico ya está registrado. Usa otro correo o contacta a soporte.'
        );
      } else if (err instanceof RateLimitError) {
        setSubmitError(
          `Demasiados intentos. Esperá ${String(err.retryAfterSeconds ?? 30)} segundos e intentá de nuevo.`
        );
      } else {
        setSubmitError('No se pudo guardar la información. Intenta de nuevo.');
      }
    }
  }

  const hasErrors = Object.keys(errors).length > 0 || submitError !== null;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
      <StepHeader
        icon={User}
        title="Datos del representante"
        description="Ingresa los datos de contacto del representante legal de la empresa."
      />

      <StepErrorBanner
        message={
          hasErrors ? (submitError ?? 'Por favor, corrige los errores en el formulario.') : null
        }
      />

      <form
        role="form"
        aria-labelledby="step-heading"
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="flex flex-col gap-6"
        noValidate
      >
        <RepresentativeFormFields register={register} control={control} errors={errors} />

        <WizardNav
          currentStep="representative"
          draftId={draftId}
          onContinue={handleSubmit(onSubmit)}
          isSubmitting={isSubmitting}
          continueLabel="Continuar"
          continueLoadingLabel="Enviando código..."
        />
      </form>
    </div>
  );
}
