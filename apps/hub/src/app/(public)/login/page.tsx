import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@core/ui';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { JSX } from 'react';

import { LoginForm } from '@/modules/iam/authentication/components/login-form';

export const metadata: Metadata = {
  title: 'Iniciar sesión | Corehub',
};

interface LoginPageProps {
  searchParams: Promise<{ recovered?: string; 'first-login'?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps): Promise<JSX.Element> {
  const params = await searchParams;
  const recovered = params.recovered === 'true';

  if (params['first-login'] === 'true') {
    redirect('/first-login');
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle id="login-title">Iniciar sesión</CardTitle>
        <CardDescription>Accedé a tu portal de aplicaciones</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {recovered && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-green-500/30 bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300"
          >
            Contraseña actualizada correctamente. Iniciá sesión con tu nueva contraseña.
          </div>
        )}

        <LoginForm />

        <div className="flex flex-col gap-2 text-center text-sm">
          <Link href="/recover" className="text-primary hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
          <Link href="/signup" className="text-muted-foreground hover:text-foreground">
            ¿No tenés cuenta?{' '}
            <span className="text-primary hover:underline">Registrá tu empresa</span>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
