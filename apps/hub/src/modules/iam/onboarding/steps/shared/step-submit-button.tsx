'use client';

import { Button } from '@core/ui';
import { type JSX } from 'react';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StepSubmitButtonProps {
  isSubmitting: boolean;
  text: string;
  loadingText: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StepSubmitButton({
  isSubmitting,
  text,
  loadingText,
}: StepSubmitButtonProps): JSX.Element {
  return (
    <Button
      type="submit"
      variant="default"
      disabled={isSubmitting}
      aria-busy={isSubmitting}
      className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold"
    >
      {isSubmitting ? loadingText : text}
    </Button>
  );
}
