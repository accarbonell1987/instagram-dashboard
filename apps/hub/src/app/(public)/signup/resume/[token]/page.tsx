'use client';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@core/ui';
import { AlertTriangle, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState, type JSX } from 'react';

import { ApiError } from '@/lib/api/errors';
import { consumeResumeToken, getDraft } from '@/modules/iam/onboarding/services/draft.service';
import { deriveCurrentStep } from '@/modules/iam/onboarding/state/wizard-machine';

export default function ResumePage({
  params,
}: {
  params: Promise<{ token: string }>;
}): JSX.Element {
  const router = useRouter();
  const { token } = use(params);
  const [isExpired, setIsExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resumeDraft(): Promise<void> {
      try {
        const { draftId } = await consumeResumeToken(token);
        const draft = await getDraft(draftId);
        const currentStep = deriveCurrentStep(draft);

        if (!cancelled) {
          router.replace(`/signup/${draftId}/${currentStep}`);
        }
      } catch (err) {
        if (cancelled) return;

        if (err instanceof ApiError && err.status === 410) {
          setIsExpired(true);
        } else {
          setError('No se pudo retomar el registro. Intenta de nuevo.');
        }
      }
    }

    void resumeDraft();

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  if (isExpired) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center pb-2">
            <div className="bg-destructive/10 flex h-16 w-16 items-center justify-center rounded-full">
              <Clock className="text-destructive h-8 w-8" aria-hidden="true" />
            </div>
          </div>
          <CardTitle className="text-center">Este enlace expiró</CardTitle>
          <CardDescription className="text-center">
            El enlace de reanudación ya no es válido. Podés comenzar el registro de nuevo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => { router.push('/signup'); }}>
            Comenzar de nuevo
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (error !== null) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center pb-2">
            <div className="bg-destructive/10 flex h-16 w-16 items-center justify-center rounded-full">
              <AlertTriangle className="text-destructive h-8 w-8" aria-hidden="true" />
            </div>
          </div>
          <CardTitle className="text-center">Error al retomar</CardTitle>
          <CardDescription className="text-center">{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => { router.push('/signup'); }}>
            Comenzar de nuevo
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      <div
        className="border-primary h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
        role="status"
        aria-label="Retomando registro..."
      />
    </div>
  );
}
