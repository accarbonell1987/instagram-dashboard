'use client';

import { type JSX } from 'react';

import { Label } from '@core/ui';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StepFormFieldProps {
  id: string;
  label: string;
  error?: string | undefined;
  children: JSX.Element;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StepFormField({ id, label, error, children }: StepFormFieldProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-foreground text-sm font-medium">
        {label}
      </Label>
      {children}
      {error !== undefined && (
        <p id={`${id}-error`} className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
