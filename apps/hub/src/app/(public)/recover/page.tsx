import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@core/ui';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import type { JSX } from 'react';

import { RecoverForm } from '@/modules/iam/authentication/components/recover-form';

export const metadata: Metadata = {
  title: 'Recuperar contraseña | Corehub',
};

export default async function RecoverPage(): Promise<JSX.Element> {
  const headersList = await headers();
  const tenantSlug = headersList.get('x-tenant-slug') ?? '';

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle id="recover-title">Recuperar contraseña</CardTitle>
        <CardDescription>
          Ingresá tu correo y te enviaremos instrucciones para restablecer tu contraseña.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <RecoverForm tenantSlug={tenantSlug} />

        <p className="text-muted-foreground text-center text-sm">
          <Link href="/login" className="text-primary hover:underline">
            Volver al inicio de sesión
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
