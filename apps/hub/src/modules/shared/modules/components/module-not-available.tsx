'use client';

import type { JSX } from 'react';

import { Lock } from 'lucide-react';

interface ModuleNotAvailableProps {
  moduleId: string;
}

export function ModuleNotAvailable({ moduleId }: ModuleNotAvailableProps): JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-full">
        <Lock className="text-muted-foreground h-8 w-8" />
      </div>
      <div className="max-w-sm">
        <h2 className="text-foreground mb-2 text-lg font-semibold">Acceso no disponible</h2>
        <p className="text-muted-foreground text-sm">
          No tenés acceso al módulo{' '}
          <span className="text-foreground font-medium">{moduleId}</span>. Contactá a tu
          administrador si creés que es un error.
        </p>
      </div>
    </div>
  );
}
