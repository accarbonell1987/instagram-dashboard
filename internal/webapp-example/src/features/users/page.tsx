'use client';

import { Button } from '@core/ui';
import { UploadIcon, UsersIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  AssignPersonDialog,
  AssignRoleDialog,
  BatchActionToolbar,
  BatchCreateDialog,
  BatchDeleteDialog,
  UserFormDialog,
  UsersTable,
} from './components';
import { useUsers } from './hooks/use-users';
import type { User, UserCreate } from './users.types';

import {
  CrudPageLayout,
  DeleteConfirmationDialog,
  Pagination,
  SearchInput,
} from '@/shared/components';

interface BatchCreateResult<T> {
  created: T[];
  total: number;
}

interface BatchDeleteResult {
  deleted: number;
  notFound?: string[] | undefined;
}

/**
 * Users page component using Screaming Architecture.
 * All user-specific code is co-located in this feature module.
 */
export function UsersPage() {
  const { state, actions, handlers, selection, batchOperations, batchLoading } = useUsers();

  // Dialog open states for batch operations and assignments
  const [batchCreateOpen, setBatchCreateOpen] = useState(false);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [assignRoleOpen, setAssignRoleOpen] = useState(false);
  const [assignPersonOpen, setAssignPersonOpen] = useState(false);

  // Track which user is being assigned (for row-level actions)
  const [userForAssignment, setUserForAssignment] = useState<User | null>(null);

  // ─── Row Action Handlers ─────────────────────────────

  const handleAssignRoleClick = (user: User) => {
    setUserForAssignment(user);
    setAssignRoleOpen(true);
  };

  const handleAssignPersonClick = (user: User) => {
    setUserForAssignment(user);
    setAssignPersonOpen(true);
  };

  // ─── Batch Operation Handlers ────────────────────────

  const handleBatchCreate = async (
    users: UserCreate[]
  ): Promise<BatchCreateResult<User>> => {
    const batchCreate = batchOperations.batchCreate as unknown as (data: {
      users: UserCreate[];
    }) => Promise<unknown>;

    const result = (await batchCreate({ users })) as BatchCreateResult<User>;

    const { created, total } = result;

    if (created.length > 0) {
      toast.success(`${String(created.length)} usuarios creados exitosamente`);
    }
    if (total - created.length > 0) {
      toast.error(`${String(total - created.length)} usuarios fallaron al crear`);
    }

    return result;
  };

  const handleBatchDelete = async (): Promise<BatchDeleteResult> => {
    const batchDelete = batchOperations.batchDelete as unknown as () => Promise<unknown>;

    const result = (await batchDelete()) as BatchDeleteResult;

    const { deleted, notFound } = result;

    if (deleted > 0) {
      toast.success(`${String(deleted)} usuarios eliminados exitosamente`);
    }
    if (notFound && notFound.length > 0) {
      toast.error(`${String(notFound.length)} usuarios no encontrados`);
    }
    setBatchDeleteOpen(false);
    return result;
  };

  const handleAssignRole = async (userId: string, data: { roleId: string }): Promise<void> => {
    const success = await batchOperations.assignRole(userId, data.roleId);
    if (success) {
      toast.success('Rol asignado exitosamente');
    } else {
      toast.error('Error al asignar rol');
      throw new Error('Error al asignar rol');
    }
  };

  const handleAssignPerson = async (userId: string, data: { partyId: string }): Promise<void> => {
    const success = await batchOperations.assignPerson(userId, data.partyId);
    if (success) {
      toast.success('Persona vinculada exitosamente');
    } else {
      toast.error('Error al vincular persona');
      throw new Error('Error al vincular persona');
    }
  };

  return (
    <>
      <CrudPageLayout
        icon={<UsersIcon className="h-8 w-8" />}
        title="Users"
        description="CRUD demo powered by @core/core with centralized domain services"
        total={state.total}
        countLabel="users"
        createLabel="New User"
        onCreateClick={actions.openCreate}
        error={state.error}
        onClearError={actions.clearError}
        headerActions={
          <Button
            variant="outline"
            onClick={() => {
              setBatchCreateOpen(true);
            }}
          >
            <UploadIcon className="mr-2 h-4 w-4" />
            Importar
          </Button>
        }
        searchInput={
          <SearchInput
            value={state.search}
            onChange={actions.setSearch}
            placeholder="Search by name or email..."
            label="Search users"
          />
        }
        pagination={
          <Pagination
            page={state.page}
            totalPages={state.totalPages}
            onPrevious={actions.previousPage}
            onNext={actions.nextPage}
          />
        }
      >
        <UsersTable
          users={state.items}
          loading={state.loading}
          onEdit={handlers.openEdit}
          onDelete={actions.openDelete}
          selectable
          selectedIds={selection.selectedIds}
          onSelectionChange={selection.setSelectedIds}
          onAssignRole={handleAssignRoleClick}
          onAssignPerson={handleAssignPersonClick}
        />
      </CrudPageLayout>

      {/* Batch Action Toolbar (fixed at bottom when items selected) */}
      <BatchActionToolbar
        selectedCount={selection.selectedIds.length}
        onDelete={() => {
          setBatchDeleteOpen(true);
        }}
        onClear={selection.clearSelection}
        isDeleting={batchLoading.batchDeleting}
      />

      {/* Create Dialog */}
      <UserFormDialog
        open={state.createOpen}
        onOpenChange={(open) => {
          if (!open) actions.closeDialogs();
        }}
        title="Create User"
        description="Add a new user to the system."
        formData={state.formData}
        onFormChange={actions.setFormData}
        onSubmit={handlers.create}
        submitLabel="Create"
        loading={state.mutating}
      />

      {/* Edit Dialog */}
      <UserFormDialog
        open={state.editOpen}
        onOpenChange={(open) => {
          if (!open) actions.closeDialogs();
        }}
        title="Edit User"
        description={`Editing ${state.selectedItem?.name ?? state.selectedItem?.email ?? 'user'}.`}
        formData={state.formData}
        onFormChange={actions.setFormData}
        onSubmit={handlers.update}
        submitLabel="Save Changes"
        loading={state.mutating}
      />

      {/* Delete Confirmation (single item) */}
      <DeleteConfirmationDialog
        open={state.deleteOpen}
        onOpenChange={(open) => {
          if (!open) actions.closeDialogs();
        }}
        entityType="User"
        itemName={state.selectedItem?.name ?? state.selectedItem?.email ?? ''}
        onConfirm={handlers.delete}
        loading={state.mutating}
      />

      {/* Batch Create Dialog (Import) */}
      <BatchCreateDialog
        open={batchCreateOpen}
        onOpenChange={setBatchCreateOpen}
        onSubmit={handleBatchCreate}
        isCreating={batchLoading.batchCreating}
      />

      {/* Batch Delete Dialog */}
      <BatchDeleteDialog
        open={batchDeleteOpen}
        onOpenChange={setBatchDeleteOpen}
        selectedCount={selection.selectedIds.length}
        onConfirm={handleBatchDelete}
        isDeleting={batchLoading.batchDeleting}
      />

      {/* Assign Role Dialog */}
      {userForAssignment && (
        <AssignRoleDialog
          open={assignRoleOpen}
          onOpenChange={(open: boolean) => {
            setAssignRoleOpen(open);
            if (!open) setUserForAssignment(null);
          }}
          user={userForAssignment}
          onSubmit={handleAssignRole}
          isLoading={batchLoading.assigning}
        />
      )}

      {/* Assign Person Dialog */}
      {userForAssignment && (
        <AssignPersonDialog
          open={assignPersonOpen}
          onOpenChange={(open: boolean) => {
            setAssignPersonOpen(open);
            if (!open) setUserForAssignment(null);
          }}
          user={userForAssignment}
          onSubmit={handleAssignPerson}
          isLoading={batchLoading.assigning}
        />
      )}
    </>
  );
}

export default UsersPage;
