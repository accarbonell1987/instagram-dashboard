'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** Returns false during SSR and the first client render, true after hydration. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
