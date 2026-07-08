import type { RoleFormData } from './roles.types';

/** Default page size for roles list */
export const PAGE_SIZE = 5;

/** Empty form data for creating a new role */
export const EMPTY_FORM: RoleFormData = {
  name: '',
  description: '',
  permissions: [],
};

/** Available permissions for the checkbox list */
export const AVAILABLE_PERMISSIONS = [
  { id: 'users:read', label: 'Read Users' },
  { id: 'users:write', label: 'Write Users' },
  { id: 'users:delete', label: 'Delete Users' },
  { id: 'parties:read', label: 'Read Parties' },
  { id: 'parties:write', label: 'Write Parties' },
  { id: 'parties:delete', label: 'Delete Parties' },
  { id: 'roles:read', label: 'Read Roles' },
  { id: 'roles:write', label: 'Write Roles' },
  { id: 'roles:delete', label: 'Delete Roles' },
  { id: 'admin:full', label: 'Full Admin Access' },
] as const;
