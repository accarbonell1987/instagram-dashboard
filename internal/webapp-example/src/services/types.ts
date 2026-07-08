/**
 * Domain Services Types
 *
 * Shared type definitions for the domain services layer.
 */
import type { CrudService } from '@core/core/services';

import type { UserExtensions } from './extensions';

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

// ─── Extended Service Types ────────────────────────────

/**
 * User service with CRUD operations plus custom extensions.
 */
export type ExtendedUserService = CrudService<User, UserCreate, UserUpdate> & UserExtensions;

// ─── Domain Services Interface ─────────────────────────

/**
 * All domain services available in the application.
 *
 * Each service provides typed access to API endpoints for its entity.
 * Extended services include custom methods beyond CRUD.
 */
export interface DomainServices {
  /** User service with batch operations and role/person assignment */
  users: ExtendedUserService;
  /** Party service with standard CRUD operations */
  parties: CrudService<Party, PartyCreate, PartyUpdate>;
  /** Role service with standard CRUD operations */
  roles: CrudService<Role, RoleCreate, RoleUpdate>;
}
