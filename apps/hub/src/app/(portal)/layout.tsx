'use client';

import type { ReactNode } from 'react';

import { Footer } from '@/components/footer';
import { Header } from '@/components/header';
import { RequireAuth } from '@/modules/iam/identity/guards/require-auth';

interface PortalLayoutProps {
  children: ReactNode;
}

export default function PortalLayout({ children }: PortalLayoutProps) {
  return (
    <RequireAuth>
      <div className="bg-background flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 pt-12">{children}</main>
        <Footer />
      </div>
    </RequireAuth>
  );
}
