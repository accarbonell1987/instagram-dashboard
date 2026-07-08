'use client';

import { ThemeProvider } from '@core/shared/providers';
import { TooltipProvider } from '@core/ui';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
      defaultColorTheme="zinc"
    >
      <TooltipProvider>{children}</TooltipProvider>
    </ThemeProvider>
  );
}
