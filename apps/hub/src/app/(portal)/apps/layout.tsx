import type { ReactNode } from 'react';

import { ModulesSidebar } from '@/modules/shared/modules/index';

interface AppsLayoutProps {
  children: ReactNode;
}

export default function AppsLayout({ children }: AppsLayoutProps) {
  return (
    <div className="flex h-full">
      <ModulesSidebar />
      <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
