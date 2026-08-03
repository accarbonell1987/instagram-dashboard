'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@core/ui';
import { LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { JSX } from 'react';

import { useModules } from '../hooks/use-modules';

import { moduleVisuals, isLocalModule } from '@/lib/apps-config';

export function ModulesMenu(): JSX.Element | null {
  const pathname = usePathname();
  const { modules, isLoading, error } = useModules();

  if (isLoading || error !== null || modules.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost-border" size="icon-sm" aria-label="Módulos">
          <LayoutGrid />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Módulos</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {modules.map((module) => {
          const Icon = moduleVisuals[module.id]?.icon;
          const href = isLocalModule(module.defaultUrl)
            ? module.defaultUrl
            : `/apps/${module.id}`;
          const isActive = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <DropdownMenuItem key={module.id} asChild>
              <Link
                href={href}
                className="cursor-pointer"
                aria-current={isActive ? 'page' : undefined}
              >
                {Icon !== undefined && <Icon className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />}
                <span className="truncate">{module.name}</span>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
