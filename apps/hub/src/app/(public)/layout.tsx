'use client';

import type { ReactNode } from 'react';

import { Header } from '@/components/header';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 pt-12">
        <div className="w-full">{children}</div>
      </main>
      <footer className="border-t px-6 py-4 text-center">
        <p className="text-muted-foreground text-xs">
          &copy; {new Date().getFullYear()} Corehub. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
}
