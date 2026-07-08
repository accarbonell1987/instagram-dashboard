import type { Party, PartyCreate, PartyUpdate } from '@/types/entities';

// Re-export entity types for convenience
export type { Party, PartyCreate, PartyUpdate };

/**
 * Party type values.
 */
export type PartyType = 'person' | 'organization';

/**
 * Form data for creating/editing a party.
 */
export interface PartyFormData {
  type: PartyType;
  displayName: string;
  email: string;
  phone: string;
}

/**
 * Convert form data to PartyCreate payload.
 */
export function toPartyCreate(form: PartyFormData): PartyCreate {
  return {
    type: form.type,
    displayName: form.displayName,
    email: form.email || undefined,
    phone: form.phone || undefined,
  };
}

/**
 * Convert form data to PartyUpdate payload.
 */
export function toPartyUpdate(form: PartyFormData): PartyUpdate {
  return {
    type: form.type,
    displayName: form.displayName,
    email: form.email || undefined,
    phone: form.phone || undefined,
  };
}

/**
 * Convert a Party entity to form data for editing.
 */
export function toPartyFormData(party: Party): PartyFormData {
  return {
    type: party.type,
    displayName: party.displayName,
    email: party.email ?? '',
    phone: party.phone ?? '',
  };
}
