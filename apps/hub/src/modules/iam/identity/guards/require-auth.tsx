'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactElement, type ReactNode } from 'react';

import { useSession } from '../hooks/use-session';

interface RequireAuthProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Client-side auth guard. Redirects to /login when unauthenticated.
 * Renders fallback (default: minimal loader) while refreshing.
 */
export function RequireAuth({ children, fallback }: RequireAuthProps): ReactElement {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'authenticated') {
    return <>{children}</>;
  }

  if (status === 'refreshing') {
    return <>{fallback ?? <DefaultLoader />}</>;
  }

  // unauthenticated: render nothing while redirect fires
  return <></>;
}

function DefaultLoader(): ReactElement {
  return (
    <div
      role="status"
      aria-label="Verificando sesión"
      className="flex h-screen items-center justify-center"
    >
      <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
    </div>
  );
}
