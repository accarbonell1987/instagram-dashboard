'use client';

import { useState, useEffect, useCallback } from 'react';

export interface UseModuleAccessOptions {
  /**
   * Fetches the module ids the current user/tenant is entitled to for the
   * calling product. This package doesn't know how a product reaches its
   * own API — pass a stable reference (e.g. a module-level function) so
   * this hook only fetches once on mount.
   */
  fetcher: () => Promise<string[]>;
  /**
   * Shown when the fetch fails without a real `Error` message. This package
   * doesn't own product-facing copy or language — the caller supplies it.
   */
  fallbackErrorMessage: string;
}

export interface UseModuleAccessResult {
  // null means "unknown" (loading or failed) — callers must treat it as
  // nothing-granted, never as "everything granted". A non-null empty Set is
  // a real zero-entitlement tenant, which is a valid, distinct state.
  moduleIds: Set<string> | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useModuleAccess(options: UseModuleAccessOptions): UseModuleAccessResult {
  const { fetcher, fallbackErrorMessage } = options;
  const [moduleIds, setModuleIds] = useState<Set<string> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const ids = await fetcher();
      setModuleIds(new Set(ids));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : fallbackErrorMessage;
      setError(message);
      // Fail closed: never leave a stale granted set behind a failed refetch.
      setModuleIds(null);
    } finally {
      setIsLoading(false);
    }
  }, [fetcher, fallbackErrorMessage]);

  useEffect(() => {
    void fetchModules();
  }, [fetchModules]);

  return { moduleIds, isLoading, error, refetch: fetchModules };
}
