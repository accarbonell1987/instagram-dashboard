'use client';

import { useEffect, useState } from 'react';

import type { TenantAdminSection } from '../services/products.service';
import { getTenantAdminSections } from '../services/products.service';

interface UseAdminSectionsResult {
  sections: TenantAdminSection[];
  isLoading: boolean;
}

/**
 * The settings screens the tenant's products contribute.
 *
 * A failure resolves to an empty list rather than an error: these are extra
 * entries in a nav that works without them, and a broken product must not take
 * the settings area down with it.
 */
export function useAdminSections(): UseAdminSectionsResult {
  const [sections, setSections] = useState<TenantAdminSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getTenantAdminSections()
      .then((result) => {
        if (!cancelled) setSections(result);
      })
      .catch(() => {
        if (!cancelled) setSections([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { sections, isLoading };
}
