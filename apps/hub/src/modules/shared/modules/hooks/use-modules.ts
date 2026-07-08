'use client';

import { useEffect, useState } from 'react';

import type { AccessibleModule } from '../services/modules.service';
import { getAccessibleModules } from '../services/modules.service';

interface UseModulesResult {
  modules: AccessibleModule[];
  isLoading: boolean;
  error: Error | null;
}

export function useModules(): UseModulesResult {
  const [modules, setModules] = useState<AccessibleModule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    getAccessibleModules()
      .then((result) => {
        if (!cancelled) {
          setModules(result);
          setIsLoading(false);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError : new Error(String(fetchError)));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { modules, isLoading, error };
}
