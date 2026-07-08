'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type JSX } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@core/ui';
import { Mail, AlertTriangle, Check } from 'lucide-react';
import Link from 'next/link';

import { FirstLoginForm } from '@/modules/iam/authentication/components/first-login-form';
import { validateFirstLoginToken } from '@/modules/iam/authentication/services/auth.service';

type TokenState =
  | { status: 'loading' }
  | { status: 'valid'; email: string; fullName: string; tenantName: string }
  | { status: 'expired' }
  | { status: 'invalid' };

export default function FirstLoginPage(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [state, setState] = useState<TokenState>({ status: 'loading' });
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (token === '') {
      setState({ status: 'invalid' });
      return;
    }

    void validateFirstLoginToken(token)
      .then((result) => {
        setState({ status: 'valid', ...result });
        router.replace('/first-login');
      })
      .catch(() => {
        setState({ status: 'expired' });
      });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Success screen (after password is set) ───────────────────────────────────

  if (completed) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center pb-2">
            <div className="bg-primary/10 flex h-16 w-16 items-center justify-center rounded-full">
              <Check className="text-primary h-8 w-8" aria-hidden="true" />
            </div>
          </div>
          <CardTitle className="text-center">Cuenta activada</CardTitle>
          <CardDescription className="text-center">
            Tu cuenta ha sido activada correctamente. Ahora podés iniciar sesión.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => { router.push('/login'); }}>
            Iniciar sesión
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Loading / Expired / Invalid / Valid ─────────────────────────────────────

  if (state.status === 'loading') {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardContent className="flex items-center justify-center py-12">
          <div
            className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
            role="status"
            aria-label="Validando token..."
          />
        </CardContent>
      </Card>
    );
  }

  if (state.status === 'expired') {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center pb-2">
            <div className="bg-destructive/10 flex h-16 w-16 items-center justify-center rounded-full">
              <AlertTriangle className="text-destructive h-8 w-8" aria-hidden="true" />
            </div>
          </div>
          <CardTitle className="text-center">Enlace expirado</CardTitle>
          <CardDescription className="text-center">
            Este enlace de activación ya no es válido. Solicita uno nuevo a tu administrador.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (state.status === 'invalid') {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle id="first-login-title">Activar cuenta</CardTitle>
          <CardDescription>
            Bienvenido. Configurá tu contraseña para activar tu cuenta.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          <FirstLoginForm initialEmail="" onSuccess={() => { setCompleted(true); }} />

          <p className="text-muted-foreground text-center text-sm">
            ¿Ya tenés una cuenta?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Iniciá sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <div className="flex justify-center pb-2">
          <div className="bg-primary/10 flex h-16 w-16 items-center justify-center rounded-full">
            <Mail className="text-primary h-8 w-8" aria-hidden="true" />
          </div>
        </div>
        <CardTitle className="text-center">Activar cuenta</CardTitle>
        <CardDescription className="text-center">
          Bienvenido{state.fullName !== '' ? `, ${state.fullName}` : ''}.{' '}
          <strong className="text-foreground">{state.tenantName}</strong> ya es parte de Corehub.
          Configurá tu contraseña para empezar.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <FirstLoginForm initialEmail={state.email} onSuccess={() => { setCompleted(true); }} />
      </CardContent>
    </Card>
  );
}
