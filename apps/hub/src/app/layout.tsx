import { ThemeProvider } from '@core/shared/providers';
import { Toaster, TooltipProvider } from '@core/ui';
import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import type React from 'react';

import { Providers } from './providers';

import { ServicesProvider } from '@/providers';

import './globals.css';

const ibmPlexSans = IBM_Plex_Sans({
  weight: ['300', '400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-sans',
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Corehub | HUB',
  description: 'Portal centralizado de aplicaciones',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          defaultColorTheme="orange"
        >
          <TooltipProvider>
            <Providers>
              <ServicesProvider>
                {children}
                <Toaster />
              </ServicesProvider>
            </Providers>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
