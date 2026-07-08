'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { coreServices, store } from '@/lib/services';

// Module-level guard prevents double initialization in React Strict Mode
// (advanced-init-once). Unlike useRef, this persists across remounts.
let initialized = false;

function ensureInitialized(): void {
  if (!initialized) {
    store.getState().initialize(coreServices);
    initialized = true;
  }
}

export function ServicesProvider({
  children,
}: {
  children: ReactNode;
}): React.ReactElement | null {
  const [ready, setReady] = useState(initialized);

  useEffect(() => {
    ensureInitialized();
    setReady(true);
  }, []);

  if (!ready) return null;

  return <>{children}</>;
}
