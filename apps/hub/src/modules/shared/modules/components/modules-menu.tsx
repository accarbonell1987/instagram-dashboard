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

  // Group children by parent for indented rendering.
  const rootModules = modules.filter((m) => m.parentId === null);
  const childrenByParent = new Map<string, typeof modules>();
  for (const m of modules) {
    if (m.parentId !== null) {
      const list = childrenByParent.get(m.parentId) ?? [];
      list.push(m);
      childrenByParent.set(m.parentId, list);
    }
  }

  function renderModuleItem(module: typeof modules[number], isChild = false) {
    const Icon = moduleVisuals[module.id]?.icon;
    const href = isLocalModule(module.defaultUrl)
      ? module.defaultUrl
      : `/apps/${module.id}`;
    const isActive = pathname === href || pathname.startsWith(`${href}/`);

    return (
      <DropdownMenuItem key={module.id} asChild>
        <Link
          href={href}
          className={`cursor-pointer ${isChild ? 'pl-6 text-sm text-muted-foreground' : ''}`}
          aria-current={isActive ? 'page' : undefined}
        >
          {Icon !== undefined && <Icon className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />}
          <span className="truncate">{module.name}</span>
        </Link>
      </DropdownMenuItem>
    );
  }

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
        {rootModules.map((module) => {
          const children = childrenByParent.get(module.id);
          return (
            <div key={module.id}>
              {renderModuleItem(module)}
              {children?.map((child) => renderModuleItem(child, true))}
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
