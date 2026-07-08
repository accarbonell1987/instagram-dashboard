'use client';

import { ThemeToggleSelector } from '@core/shared/components';
import { Button } from '@core/ui';
import { BuildingIcon, PaletteIcon, ShieldIcon, UserIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { ThemeSelector } from '@/components/theme-selector';

export function ShowcaseNav() {
  const [themeSelectorOpen, setThemeSelectorOpen] = useState(false);

  return (
    <>
      <nav className="bg-card sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="from-primary to-secondary h-8 w-8 rounded-xl bg-linear-to-br" />
            <span className="font-display text-xl font-bold">WebApp Example</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/components"
              className="hover:text-primary text-sm font-medium transition-colors"
            >
              Componentes
            </Link>
            <Link
              href="/users"
              className="hover:text-primary flex items-center gap-1.5 text-sm font-medium transition-colors"
            >
              <UserIcon className="h-4 w-4" />
              Users
            </Link>
            <Link
              href="/parties"
              className="hover:text-primary flex items-center gap-1.5 text-sm font-medium transition-colors"
            >
              <BuildingIcon className="h-4 w-4" />
              Parties
            </Link>
            <Link
              href="/roles"
              className="hover:text-primary flex items-center gap-1.5 text-sm font-medium transition-colors"
            >
              <ShieldIcon className="h-4 w-4" />
              Roles
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggleSelector />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setThemeSelectorOpen(true);
                }}
                aria-label="Select color theme"
              >
                <PaletteIcon className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </nav>
      <ThemeSelector open={themeSelectorOpen} onOpenChange={setThemeSelectorOpen} />
    </>
  );
}
