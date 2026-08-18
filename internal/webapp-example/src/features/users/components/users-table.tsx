'use client';

import {
  Button,
  Checkbox,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Td,
  Th,
  Tr,
} from '@core/ui';
import { MoreHorizontal, PencilIcon, ShieldIcon, TrashIcon, UserIcon } from 'lucide-react';

import type { User } from '../users.types';

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
  const selectedSet = new Set(selectedIds);
  const allSelected = users.length > 0 && users.every((user) => selectedSet.has(user.id));
  const someSelected = users.some((user) => selectedSet.has(user.id)) && !allSelected;

  function toggleAll(): void {
    if (!onSelectionChange) return;
    onSelectionChange(allSelected ? [] : users.map((user) => user.id));
  }

  function toggleOne(userId: string): void {
    if (!onSelectionChange) return;
    onSelectionChange(
      selectedSet.has(userId) ? selectedIds.filter((id) => id !== userId) : [...selectedIds, userId]
    );
  }

  return (
    <DataTable
      isLoading={loading}
      isEmpty={users.length === 0}
      empty={{ text: 'No users found.' }}
      caption="Users"
      head={
        <>
          {selectable && (
            <Th width="w-12">
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={toggleAll}
                aria-label="Select all users"
              />
            </Th>
          )}
          <Th width="w-16">ID</Th>
          <Th>Name</Th>
          <Th>Email</Th>
          <Th width="w-32">Party ID</Th>
          <Th width="w-40">Created</Th>
          <Th width="w-24" align="right">
            Actions
          </Th>
        </>
      }
    >
      {users.map((user) => (
        <Tr key={user.id}>
          {selectable && (
            <Td>
              <Checkbox
                checked={selectedSet.has(user.id)}
                onCheckedChange={() => {
                  toggleOne(user.id);
                }}
                aria-label={`Select ${user.name ?? user.email}`}
              />
            </Td>
          )}
          <Td className="text-muted-foreground font-mono text-sm">{user.id}</Td>
          <Td className="font-medium">{user.name ?? '—'}</Td>
          <Td className="text-muted-foreground">{user.email}</Td>
          <Td className="text-muted-foreground font-mono text-xs">{user.partyId}</Td>
          <Td className="text-muted-foreground text-sm">
            {new Date(user.createdAt).toLocaleDateString()}
          </Td>
          <Td align="right">
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
          </Td>
        </Tr>
      ))}
    </DataTable>
  );
}
