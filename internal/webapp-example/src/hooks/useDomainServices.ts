'use client';

import { useMemo } from 'react';

import { useServices } from '@/lib/services';
import { getDomainServices, type DomainServices } from '@/services';

/**
 * Hook to access domain services in React components.
 *
 * Usage:
 *   const { users, parties, roles } = useDomainServices();
 *   const allUsers = await users.getAll();
 */
export function useDomainServices(): DomainServices {
  // This ensures coreServices is initialized (throws if not)
  useServices();

  // Return memoized services
  return useMemo(() => getDomainServices(), []);
}
