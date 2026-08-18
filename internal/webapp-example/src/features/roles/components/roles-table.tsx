'use client';

import { Badge, Button, DataTable, Td, Th, Tr } from '@core/ui';
import { PencilIcon, TrashIcon } from 'lucide-react';

import type { Role } from '../roles.types';

export interface RolesTableProps {
  /** Roles to display */
  roles: Role[];
  /** Whether data is loading */
  loading: boolean;
  /** Callback when edit button is clicked */
  onEdit: (role: Role) => void;
  /** Callback when delete button is clicked */
  onDelete: (role: Role) => void;
}

function PermissionBadges({ permissions }: { permissions: string[] }) {
  const MAX_DISPLAY = 3;
  const displayPermissions = permissions.slice(0, MAX_DISPLAY);
  const remaining = permissions.length - MAX_DISPLAY;

  if (permissions.length === 0) {
    return <span className="text-muted-foreground text-sm">No permissions</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {displayPermissions.map((permission) => (
        <Badge key={permission} variant="outline" className="text-xs">
          {permission}
        </Badge>
      ))}
      {remaining > 0 && (
        <Badge variant="secondary" className="text-xs">
          +{remaining} more
        </Badge>
      )}
    </div>
  );
}

export function RolesTable({ roles, loading, onEdit, onDelete }: RolesTableProps) {
  return (
    <DataTable
      isLoading={loading}
      isEmpty={roles.length === 0}
      empty={{ text: 'No roles found.' }}
      caption="Roles"
      head={
        <>
          <Th width="w-16">ID</Th>
          <Th width="w-40">Name</Th>
          <Th>Description</Th>
          <Th>Permissions</Th>
          <Th width="w-40">Created</Th>
          <Th width="w-24" align="right">
            Actions
          </Th>
        </>
      }
    >
      {roles.map((role) => (
        <Tr key={role.id}>
          <Td className="text-muted-foreground font-mono text-sm">{role.id}</Td>
          <Td className="font-medium">{role.name}</Td>
          <Td className="text-muted-foreground max-w-xs truncate">{role.description ?? '—'}</Td>
          <Td>
            <PermissionBadges permissions={role.permissions} />
          </Td>
          <Td className="text-muted-foreground text-sm">
            {new Date(role.createdAt).toLocaleDateString()}
          </Td>
          <Td align="right">
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  onEdit(role);
                }}
                aria-label={`Edit ${role.name}`}
              >
                <PencilIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  onDelete(role);
                }}
                aria-label={`Delete ${role.name}`}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
          </Td>
        </Tr>
      ))}
    </DataTable>
  );
}
