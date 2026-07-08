/**
 * Domain Entity Types
 *
 * TypeScript types that mirror the API schemas.
 * These are used by domain services for type-safe CRUD operations.
 */

// ─── User Entity ───────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name?: string | undefined;
  partyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserCreate {
  email: string;
  name?: string | undefined;
  partyId: string;
}

export type UserUpdate = Partial<UserCreate>;

// ─── Party Entity ──────────────────────────────────────

export interface Party {
  id: string;
  type: 'person' | 'organization';
  displayName: string;
  email?: string | undefined;
  phone?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface PartyCreate {
  type: 'person' | 'organization';
  displayName: string;
  email?: string | undefined;
  phone?: string | undefined;
}

export type PartyUpdate = Partial<PartyCreate>;

// ─── Role Entity ───────────────────────────────────────

export interface Role {
  id: string;
  name: string;
  description?: string | undefined;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RoleCreate {
  name: string;
  description?: string | undefined;
  permissions: string[];
}

export type RoleUpdate = Partial<RoleCreate>;

// ─── Batch Operation Types ─────────────────────────────

// Re-export generic batch types from @core/core
export type { BatchCreateResult, BatchDeleteResult } from '@core/core/services';

export interface BatchCreateUsersInput {
  users: UserCreate[];
}

export interface BatchDeleteUsersInput {
  ids: string[];
}

// ─── Assignment Operation Types ────────────────────────

export interface AssignRoleInput {
  roleId: string;
}

export interface AssignPersonInput {
  partyId: string;
}
