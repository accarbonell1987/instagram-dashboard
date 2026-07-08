import type { UserFormData } from './users.types';

/** Default page size for users list */
export const PAGE_SIZE = 5;

/** Empty form data for creating a new user */
export const EMPTY_FORM: UserFormData = {
  name: '',
  email: '',
  role: 'viewer',
  partyId: 'default-party',
};

/** Available user roles */
export const USER_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
] as const;
