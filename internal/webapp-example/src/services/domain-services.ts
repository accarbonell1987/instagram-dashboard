/**
 * Domain Services Registry
 *
 * Orchestrates the creation and caching of all domain services.
 * Services are created lazily on first access (singleton pattern).
 *
 * This file should remain thin — extension logic lives in ./extensions/
 */
import { createUserExtensions, type UserExtensions } from './extensions';
import type { DomainServices } from './types';

import { coreServices } from '@/lib/services';
import type {
  Party,
  PartyCreate,
  PartyUpdate,
  Role,
  RoleCreate,
  RoleUpdate,
  User,
  UserCreate,
  UserUpdate,
} from '@/types/entities';

// ─── Singleton Instance ────────────────────────────────

let _services: DomainServices | null = null;

// ─── Public API ────────────────────────────────────────

/**
 * Get or create the domain services singleton.
 * Call this after coreServices is initialized.
 *
 * @returns All domain services for the application
 *
 * @example
 * ```ts
 * const services = getDomainServices();
 *
 * // Standard CRUD
 * const users = await services.users.getAll();
 *
 * // Extended methods
 * const result = await services.users.batchCreate({ users: [...] });
 * ```
 */
export function getDomainServices(): DomainServices {
  if (!_services) {
    const { createService } = coreServices;

    _services = {
      // User service with extensions
      users: createService<User, UserCreate, UserUpdate, UserExtensions>(
        '/users',
        createUserExtensions
      ),

      // Standard CRUD services
      parties: createService<Party, PartyCreate, PartyUpdate>('/parties'),
      roles: createService<Role, RoleCreate, RoleUpdate>('/roles'),
    };
  }

  return _services;
}

/**
 * Reset services singleton.
 * Useful for testing or when auth context changes.
 */
export function resetDomainServices(): void {
  _services = null;
}
