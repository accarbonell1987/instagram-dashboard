'use client';

import { Badge, Button } from '@core/ui';
import { PencilIcon, TrashIcon } from 'lucide-react';

import type { Role } from '../roles.types';

import { DataTable } from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';

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
  const columns: DataTableColumn<Role>[] = [
    {
      key: 'id',
      header: 'ID',
      width: 'w-16',
      render: (role) => <span className="text-muted-foreground font-mono text-sm">{role.id}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      width: 'w-40',
      render: (role) => <span className="font-medium">{role.name}</span>,
    },
    {
      key: 'description',
      header: 'Description',
      render: (role) => (
        <span className="text-muted-foreground max-w-xs truncate">{role.description ?? '—'}</span>
      ),
    },
    {
      key: 'permissions',
      header: 'Permissions',
      render: (role) => <PermissionBadges permissions={role.permissions} />,
    },
    {
      key: 'createdAt',
      header: 'Created',
      width: 'w-40',
      render: (role) => (
        <span className="text-muted-foreground text-sm">
          {new Date(role.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 'w-24',
      align: 'right',
      render: (role) => (
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
      ),
    },
  ];

  return (
    <DataTable
      items={roles}
      columns={columns}
      getRowKey={(role) => role.id}
      loading={loading}
      emptyMessage="No roles found."
    />
  );
}
