'use client';

import { type JSX } from 'react';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StepErrorBannerProps {
  message: string | null; // null = hidden
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StepErrorBanner({ message }: StepErrorBannerProps): JSX.Element | null {
  if (message === null) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm"
    >
      {message}
    </div>
  );
}
