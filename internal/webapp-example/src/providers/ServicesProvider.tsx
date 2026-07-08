'use client';

import { useEffect, useState } from 'react';

import { coreServices, store } from '@/lib/services';

// Module-level guard prevents double initialization in React Strict Mode
// (advanced-init-once). Unlike useRef, this persists across remounts.
let initialized = false;

function ensureInitialized() {
  if (!initialized) {
    store.getState().initialize(coreServices);
    initialized = true;
  }
}

/**
 * Initializes the services store on the client.
 *
 * Uses a module-level guard instead of useRef to ensure
 * initialization happens exactly once per app load, even
 * if the component remounts (React Strict Mode).
 */
export function ServicesProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(initialized);

  useEffect(() => {
    ensureInitialized();
    setReady(true);
  }, []);

  if (!ready) {
    return null;
  }

  return <>{children}</>;
}
