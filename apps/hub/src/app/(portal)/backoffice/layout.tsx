'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode, JSX } from 'react';

import { RequireRole } from '@/modules/iam/identity/guards/require-role';

// ─── Nav links ─────────────────────────────────────────────────────────────────

interface NavLink {
  href: string;
  label: string;
}

const NAV_LINKS: NavLink[] = [
  { href: '/backoffice/modules', label: 'Módulos' },
  { href: '/backoffice/plans', label: 'Planes' },
  { href: '/backoffice/tenants', label: 'Tenants' },
  { href: '/backoffice/quizzes', label: 'Evaluaciones' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function isLinkActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface BackofficeLayoutProps {
  children: ReactNode;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function BackofficeLayout({ children }: BackofficeLayoutProps): JSX.Element {
  const pathname = usePathname();

  return (
    <RequireRole role="SuperAdmin">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-foreground text-2xl font-semibold">Backoffice</h1>
        </div>

        <div className="flex flex-col gap-6 sm:flex-row">
          {/* Sidebar navigation */}
          <nav
            className="border-border bg-card shrink-0 rounded-lg border p-2 sm:w-48"
            aria-label="Navegación de backoffice"
          >
            <ul className="flex flex-col gap-1 sm:flex-col">
              {NAV_LINKS.map(({ href, label }) => {
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
    </RequireRole>
  );
}
