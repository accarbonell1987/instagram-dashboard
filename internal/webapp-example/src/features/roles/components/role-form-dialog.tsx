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

import type { RoleFormData } from '../roles.types';

import { isRoleFormValid, RoleForm } from './role-form';


export interface RoleFormDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Dialog title */
  title: string;
  /** Dialog description */
  description: string;
  /** Current form data */
  formData: RoleFormData;
  /** Callback when form data changes */
  onFormChange: (data: RoleFormData) => void;
  /** Callback when form is submitted */
  onSubmit: () => void;
  /** Label for the submit button */
  submitLabel: string;
  /** Whether a mutation is in progress */
  loading?: boolean;
}

export function RoleFormDialog({
  open,
  onOpenChange,
  title,
  description,
  formData,
  onFormChange,
  onSubmit,
  submitLabel,
  loading = false,
}: RoleFormDialogProps) {
  const isValid = isRoleFormValid(formData);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <RoleForm formData={formData} onChange={onFormChange} />
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
