'use client';

import type { ReactElement, ReactNode } from 'react';

import { useSession } from '../hooks/use-session';

type AllowedRole = 'SuperAdmin' | 'TenantAdmin' | 'User';

interface RequireRoleProps {
  role: AllowedRole | AllowedRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

const DEFAULT_FALLBACK = (
  <div role="alert" className="p-4 text-sm text-red-600">
    Acceso denegado
  </div>
);

/**
 * Renders children only when the authenticated user's role is in the allowed set.
 * Does NOT redirect — compose with RequireAuth for redirection.
 */
export function RequireRole({ role, children, fallback = DEFAULT_FALLBACK }: RequireRoleProps): ReactElement {
  const { session } = useSession();
  const allowedRoles = Array.isArray(role) ? role : [role];
  const userRole = session?.role ?? null;

  if (userRole !== null && allowedRoles.includes(userRole as AllowedRole)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
