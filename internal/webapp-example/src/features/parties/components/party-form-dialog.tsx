'use client';

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@core/ui';

import type { PartyFormData } from '../parties.types';

import { isPartyFormValid, PartyForm } from './party-form';


export interface PartyFormDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Dialog title */
  title: string;
  /** Dialog description */
  description: string;
  /** Current form data */
  formData: PartyFormData;
  /** Callback when form data changes */
  onFormChange: (data: PartyFormData) => void;
  /** Callback when form is submitted */
  onSubmit: () => void;
  /** Label for the submit button */
  submitLabel: string;
  /** Whether a mutation is in progress */
  loading?: boolean;
}

export function PartyFormDialog({
  open,
  onOpenChange,
  title,
  description,
  formData,
  onFormChange,
  onSubmit,
  submitLabel,
  loading = false,
}: PartyFormDialogProps) {
  const isValid = isPartyFormValid(formData);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <PartyForm formData={formData} onChange={onFormChange} />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={loading}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={onSubmit} disabled={!isValid || loading}>
            {loading ? 'Saving...' : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
