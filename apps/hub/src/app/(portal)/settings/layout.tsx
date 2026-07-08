'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode, JSX } from 'react';

import { useSession } from '@/modules/iam/identity/hooks/use-session';

// ─── Nav links ─────────────────────────────────────────────────────────────────

type AllowedRole = 'SuperAdmin' | 'TenantAdmin' | 'User';

interface NavLink {
  href: string;
  label: string;
  requiresRole?: AllowedRole[];
}

const NAV_LINKS: NavLink[] = [
  { href: '/settings', label: 'Resumen' },
  { href: '/settings/profile', label: 'Mi perfil' },
  { href: '/settings/team', label: 'Equipo' },
  { href: '/settings/organization', label: 'Organización' },
  { href: '/settings/billing', label: 'Facturación', requiresRole: ['TenantAdmin', 'SuperAdmin'] },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function isLinkActive(href: string, pathname: string): boolean {
  if (href === '/settings') return pathname === '/settings';
  return pathname === href || pathname.startsWith(`${href}/`);
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface SettingsLayoutProps {
  children: ReactNode;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function SettingsLayout({ children }: SettingsLayoutProps): JSX.Element {
  const pathname = usePathname();
  const { session } = useSession();
  const userRole = session?.role ?? null;

  const visibleLinks = NAV_LINKS.filter(
    (link) =>
      link.requiresRole === undefined ||
      (userRole !== null && link.requiresRole.includes(userRole as AllowedRole))
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-foreground text-2xl font-semibold">Configuración</h1>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        {/* Sidebar navigation */}
        <nav
          className="border-border bg-card shrink-0 rounded-lg border p-2 sm:w-48"
          aria-label="Navegación de configuración"
        >
          <ul className="flex flex-col gap-1 sm:flex-col">
            {visibleLinks.map(({ href, label }) => {
              const isActive = isLinkActive(href, pathname);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Page content */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
