import type { ReactNode } from 'react';

interface AppsLayoutProps {
  children: ReactNode;
}

export default function AppsLayout({ children }: AppsLayoutProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 top-12 overflow-hidden">{children}</div>
  );
}
