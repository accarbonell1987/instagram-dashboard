'use client';

import { Checkbox, Input, Label, Textarea } from '@core/ui';

import { AVAILABLE_PERMISSIONS } from '../roles.constants';
import type { RoleFormData } from '../roles.types';

export interface RoleFormProps {
  /** Current form data */
  formData: RoleFormData;
  /** Callback when form data changes */
  onChange: (data: RoleFormData) => void;
}

export function RoleForm({ formData, onChange }: RoleFormProps) {
  const togglePermission = (permissionId: string) => {
    const newPermissions = formData.permissions.includes(permissionId)
      ? formData.permissions.filter((p) => p !== permissionId)
      : [...formData.permissions, permissionId];
    onChange({ ...formData, permissions: newPermissions });
  };

  return (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="role-name">Name</Label>
        <Input
          id="role-name"
          value={formData.name}
          onChange={(event) => {
            onChange({ ...formData, name: event.target.value });
          }}
          placeholder="Administrator"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="role-description">Description (optional)</Label>
        <Textarea
          id="role-description"
          value={formData.description}
          onChange={(event) => {
            onChange({ ...formData, description: event.target.value });
          }}
          placeholder="Full access to all system features..."
          rows={2}
        />
      </div>
      <div className="grid gap-2">
        <Label>Permissions</Label>
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
          {AVAILABLE_PERMISSIONS.map((permission) => (
            <div key={permission.id} className="flex items-center space-x-2">
              <Checkbox
                id={`perm-${permission.id}`}
                checked={formData.permissions.includes(permission.id)}
                onCheckedChange={() => {
                  togglePermission(permission.id);
                }}
              />
              <Label
                htmlFor={`perm-${permission.id}`}
                className="cursor-pointer text-sm font-normal"
              >
                {permission.label}
                <span className="text-muted-foreground ml-2 font-mono text-xs">
                  ({permission.id})
                </span>
              </Label>
            </div>
          ))}
        </div>
        {formData.permissions.length === 0 && (
          <p className="text-destructive text-sm">Select at least one permission</p>
        )}
      </div>
    </div>
  );
}

/**
 * Validates role form data.
 */
export function isRoleFormValid(formData: RoleFormData): boolean {
  return formData.name.trim() !== '' && formData.permissions.length > 0;
}
