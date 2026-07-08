import type { PartyFormData } from './parties.types';

/** Default page size for parties list */
export const PAGE_SIZE = 5;

/** Empty form data for creating a new party */
export const EMPTY_FORM: PartyFormData = {
  type: 'person',
  displayName: '',
  email: '',
  phone: '',
};

/** Available party types */
export const PARTY_TYPES = [
  { value: 'person', label: 'Person' },
  { value: 'organization', label: 'Organization' },
] as const;
