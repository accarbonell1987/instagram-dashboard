import type { Role, RoleCreate, RoleUpdate } from '@/types/entities';

// Re-export entity types for convenience
export type { Role, RoleCreate, RoleUpdate };

/**
 * Form data for creating/editing a role.
 */
export interface RoleFormData {
  name: string;
  description: string;
  permissions: string[];
}

/**
 * Convert form data to RoleCreate payload.
 */
export function toRoleCreate(form: RoleFormData): RoleCreate {
  return {
    name: form.name,
    description: form.description || undefined,
    permissions: form.permissions,
  };
}

/**
 * Convert form data to RoleUpdate payload.
 */
export function toRoleUpdate(form: RoleFormData): RoleUpdate {
  return {
    name: form.name,
    description: form.description || undefined,
    permissions: form.permissions,
  };
}

/**
 * Convert a Role entity to form data for editing.
 */
export function toRoleFormData(role: Role): RoleFormData {
  return {
    name: role.name,
    description: role.description ?? '',
    permissions: [...role.permissions],
  };
}
