'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@core/ui';
import { MoreHorizontal, PencilIcon, ShieldIcon, TrashIcon, UserIcon } from 'lucide-react';

import type { User } from '../users.types';

import { DataTable } from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';

export interface UsersTableProps {
  /** Users to display */
  users: User[];
  /** Whether data is loading */
  loading: boolean;
  /** Callback when edit button is clicked */
  onEdit: (user: User) => void;
  /** Callback when delete button is clicked */
  onDelete: (user: User) => void;
  /** Enable row selection with checkboxes */
  selectable?: boolean;
  /** Currently selected row IDs (controlled) */
  selectedIds?: string[];
  /** Callback when selection changes */
  onSelectionChange?: (ids: string[]) => void;
  /** Callback when "Asignar Rol" is clicked */
  onAssignRole?: (user: User) => void;
  /** Callback when "Asignar Persona" is clicked */
  onAssignPerson?: (user: User) => void;
}

export function UsersTable({
  users,
  loading,
  onEdit,
  onDelete,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  onAssignRole,
  onAssignPerson,
}: UsersTableProps) {
  const columns: DataTableColumn<User>[] = [
    {
      key: 'id',
      header: 'ID',
      width: 'w-16',
      render: (user) => <span className="text-muted-foreground font-mono text-sm">{user.id}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      render: (user) => <span className="font-medium">{user.name ?? '—'}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (user) => <span className="text-muted-foreground">{user.email}</span>,
    },
    {
      key: 'partyId',
      header: 'Party ID',
      width: 'w-32',
      render: (user) => (
        <span className="text-muted-foreground font-mono text-xs">{user.partyId}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      width: 'w-40',
      render: (user) => (
        <span className="text-muted-foreground text-sm">
          {new Date(user.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 'w-24',
      align: 'right',
      render: (user) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              onEdit(user);
            }}
            aria-label={`Edit ${user.name ?? user.email}`}
          >
            <PencilIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              onDelete(user);
            }}
            aria-label={`Delete ${user.name ?? user.email}`}
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`More actions for ${user.name ?? user.email}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onAssignRole && (
                <DropdownMenuItem
                  onClick={() => {
                    onAssignRole(user);
                  }}
                >
                  <ShieldIcon className="mr-2 h-4 w-4" />
                  Asignar Rol
                </DropdownMenuItem>
              )}
              {onAssignPerson && (
                <DropdownMenuItem
                  onClick={() => {
                    onAssignPerson(user);
                  }}
                >
                  <UserIcon className="mr-2 h-4 w-4" />
                  Asignar Persona
                </DropdownMenuItem>
              )}
              {(onAssignRole !== undefined || onAssignPerson !== undefined) && (
                <DropdownMenuSeparator />
              )}
              <DropdownMenuItem
                onClick={() => {
                  onEdit(user);
                }}
              >
                <PencilIcon className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  onDelete(user);
                }}
              >
                <TrashIcon className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      items={users}
      columns={columns}
      getRowKey={(user) => user.id}
      loading={loading}
      emptyMessage="No users found."
      {...(selectable && {
        selectable,
        selectedIds,
        onSelectionChange,
      })}
    />
  );
}
