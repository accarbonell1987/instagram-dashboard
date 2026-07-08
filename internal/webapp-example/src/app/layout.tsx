import { ThemeProvider } from '@core/shared/providers';
import { Toaster, TooltipProvider } from '@core/ui';
import type { Metadata } from 'next';
import { Inter, Sora } from 'next/font/google';

import { ShowcaseNav } from '@/components/showcase-nav';
import { ServicesProvider } from '@/providers/ServicesProvider';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Pixel Studio - Creative Design Agency',
  description: 'Vibrant creative theme example',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${sora.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          defaultColorTheme="zinc"
        >
          <TooltipProvider>
            <ServicesProvider>
              <ShowcaseNav />
              {children}
              <Toaster />
            </ServicesProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
