'use client';

import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@core/ui';

import { PARTY_TYPES } from '../parties.constants';
import type { PartyFormData, PartyType } from '../parties.types';

export interface PartyFormProps {
  /** Current form data */
  formData: PartyFormData;
  /** Callback when form data changes */
  onChange: (data: PartyFormData) => void;
}

export function PartyForm({ formData, onChange }: PartyFormProps) {
  return (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="party-type">Type</Label>
        <Select
          value={formData.type}
          onValueChange={(value) => {
            onChange({ ...formData, type: value as PartyType });
          }}
        >
          <SelectTrigger id="party-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PARTY_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="party-name">Display Name</Label>
        <Input
          id="party-name"
          value={formData.displayName}
          onChange={(event) => {
            onChange({ ...formData, displayName: event.target.value });
          }}
          placeholder={formData.type === 'person' ? 'John Doe' : 'Acme Corporation'}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="party-email">Email (optional)</Label>
        <Input
          id="party-email"
          type="email"
          value={formData.email}
          onChange={(event) => {
            onChange({ ...formData, email: event.target.value });
          }}
          placeholder="contact@example.com"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="party-phone">Phone (optional)</Label>
        <Input
          id="party-phone"
          type="tel"
          value={formData.phone}
          onChange={(event) => {
            onChange({ ...formData, phone: event.target.value });
          }}
          placeholder="+1 (555) 123-4567"
        />
      </div>
    </div>
  );
}

/**
 * Validates party form data.
 */
export function isPartyFormValid(formData: PartyFormData): boolean {
  return formData.displayName.trim() !== '';
}
