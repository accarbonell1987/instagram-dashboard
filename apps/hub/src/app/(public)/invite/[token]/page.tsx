'use client';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@core/ui';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { use, type JSX } from 'react';

import { ApiError, ConflictError } from '@/lib/api/errors';
import { AcceptInvitationForm } from '@/modules/iam/invitations/components/accept-invitation-form';
import { getInvitation } from '@/modules/iam/invitations/services/invitation.service';

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default function InvitePage({ params }: InvitePageProps): JSX.Element {
  const { token } = use(params);
  const router = useRouter();

  const { data, isLoading, error } = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => getInvitation(token),
    retry: false,
  });

  if (isLoading) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardContent className="flex items-center justify-center py-12">
          <div
            className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
            role="status"
            aria-label="Verificando invitación..."
          />
        </CardContent>
      </Card>
    );
  }

  if (error !== null) {
    const isExpired = error instanceof ApiError && error.status === 410;
    const isAlreadyUsed =
      error instanceof ConflictError || (error instanceof ApiError && error.status === 409);

    if (isExpired) {
      return <ExpiredView onGoToLogin={() => { router.push('/login'); }} />;
    }

    if (isAlreadyUsed) {
      return (
        <Card className="mx-auto w-full max-w-md">
          <CardHeader>
            <div className="flex justify-center pb-2">
              <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-full">
                <CheckCircle2 className="text-muted-foreground h-8 w-8" aria-hidden="true" />
              </div>
            </div>
            <CardTitle className="text-center">Invitación ya utilizada</CardTitle>
            <CardDescription className="text-center">
              Ya existe una cuenta asociada a esta invitación. Iniciá sesión para continuar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => { router.push('/login'); }}>
              Ir a Iniciar sesión
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center pb-2">
            <div className="bg-destructive/10 flex h-16 w-16 items-center justify-center rounded-full">
              <AlertTriangle className="text-destructive h-8 w-8" aria-hidden="true" />
            </div>
          </div>
          <CardTitle className="text-center">Error al cargar la invitación</CardTitle>
          <CardDescription className="text-center">
            No pudimos verificar tu invitación. Verificá el enlace o contactá a soporte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => { router.push('/login'); }}>
            Ir a Iniciar sesión
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (data === undefined) {
    return <></>;
  }

  if (data.status === 'expired') {
    return <ExpiredView onGoToLogin={() => { router.push('/login'); }} />;
  }

  if (data.status === 'accepted') {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center pb-2">
            <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-full">
              <CheckCircle2 className="text-muted-foreground h-8 w-8" aria-hidden="true" />
            </div>
          </div>
          <CardTitle className="text-center">Invitación ya utilizada</CardTitle>
          <CardDescription className="text-center">
            Ya existe una cuenta asociada a esta invitación. Iniciá sesión para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => { router.push('/login'); }}>
            Ir a Iniciar sesión
          </Button>
        </CardContent>
      </Card>
    );
  }

  // status === 'pending'
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardContent className="pt-6">
        <AcceptInvitationForm
          token={token}
          invitation={{
            email: data.email,
            tenantName: data.tenantName,
            inviterName: data.inviterName ?? undefined,
            role: data.role,
          }}
        />
      </CardContent>
    </Card>
  );
}

function ExpiredView({ onGoToLogin }: { onGoToLogin: () => void }): JSX.Element {
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <div className="flex justify-center pb-2">
          <div className="bg-destructive/10 flex h-16 w-16 items-center justify-center rounded-full">
            <AlertTriangle className="text-destructive h-8 w-8" aria-hidden="true" />
          </div>
        </div>
        <CardTitle className="text-center">Invitación expirada</CardTitle>
        <CardDescription className="text-center">
          Las invitaciones son válidas por 7 días. Pedí a la empresa que te envíe una nueva.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button className="w-full" onClick={onGoToLogin}>
          Ir al inicio
        </Button>
      </CardContent>
    </Card>
  );
}
