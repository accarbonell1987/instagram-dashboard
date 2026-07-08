'use client';

import type { LucideIcon } from 'lucide-react';
import { type JSX } from 'react';

interface StepHeaderProps {
  icon: LucideIcon;
  title: string;
  description: React.ReactNode;
}

export function StepHeader({ icon: Icon, title, description }: StepHeaderProps): JSX.Element {
  return (
    <div className="flex items-center gap-4">
      <div className="bg-primary/10 flex h-12 min-h-12 w-12 min-w-12 items-center justify-center rounded-2xl">
        <Icon className="text-primary h-6 w-6" aria-hidden="true" />
      </div>
      <div>
        <h1
          id="step-heading"
          className="text-foreground text-2xl font-bold tracking-tight"
          tabIndex={-1}
        >
          {title}
        </h1>
        <span className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{description}</span>
      </div>
    </div>
  );
}
