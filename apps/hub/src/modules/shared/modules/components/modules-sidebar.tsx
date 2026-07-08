'use client';

import type { JSX } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@core/ui/lib';

import { moduleVisuals, isLocalModule } from '@/lib/apps-config';
import { useModules } from '../hooks/use-modules';

function SidebarSkeleton(): JSX.Element {
  return (
    <nav className="border-border bg-card flex shrink-0 flex-col gap-1 border-r p-2 sm:w-56">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="bg-muted h-10 animate-pulse rounded-md"
          style={{ animationDelay: `${String(index * 100)}ms` }}
        />
      ))}
    </nav>
  );
}

export function ModulesSidebar(): JSX.Element {
  const pathname = usePathname();
  const { modules, isLoading, error } = useModules();

  if (isLoading) return <SidebarSkeleton />;

  if (error !== null) {
    return (
      <nav className="border-border bg-card flex shrink-0 flex-col border-r p-4 sm:w-56">
        <p className="text-destructive text-xs">Error al cargar módulos</p>
      </nav>
    );
  }

  return (
    <nav
      className="border-border bg-card flex shrink-0 flex-col border-r p-2 sm:w-56"
      aria-label="Navegación de módulos"
    >
      <ul className="flex flex-col gap-1">
        {modules.map((module) => {
          const visuals = moduleVisuals[module.id];
          const Icon = visuals?.icon;
          const href = isLocalModule(module.defaultUrl)
            ? module.defaultUrl
            : `/apps/${module.id}`;
          const isActive = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={module.id}>
              <Link
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                {Icon !== undefined && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                <span className="truncate">{module.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
