'use client';

import { ShieldIcon } from 'lucide-react';


import { RoleFormDialog } from './components/role-form-dialog';
import { RolesTable } from './components/roles-table';
import { useRoles } from './hooks/use-roles';

import {
  CrudPageLayout,
  DeleteConfirmationDialog,
  Pagination,
  SearchInput,
} from '@/shared/components';

/**
 * Roles page component using Screaming Architecture.
 * All role-specific code is co-located in this feature module.
 */
export function RolesPage() {
  const { state, actions, handlers } = useRoles();

  return (
    <>
      <CrudPageLayout
        icon={<ShieldIcon className="h-8 w-8" />}
        title="Roles"
        description="Manage roles and permissions with centralized domain services"
        total={state.total}
        countLabel="roles"
        createLabel="New Role"
        onCreateClick={actions.openCreate}
        error={state.error}
        onClearError={actions.clearError}
        searchInput={
          <SearchInput
            value={state.search}
            onChange={actions.setSearch}
            placeholder="Search by name or description..."
            label="Search roles"
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
        <RolesTable
          roles={state.items}
          loading={state.loading}
          onEdit={handlers.openEdit}
          onDelete={actions.openDelete}
        />
      </CrudPageLayout>

      {/* Create Dialog */}
      <RoleFormDialog
        open={state.createOpen}
        onOpenChange={(open) => {
          if (!open) actions.closeDialogs();
        }}
        title="Create Role"
        description="Add a new role with specific permissions."
        formData={state.formData}
        onFormChange={actions.setFormData}
        onSubmit={handlers.create}
        submitLabel="Create"
        loading={state.mutating}
      />

      {/* Edit Dialog */}
      <RoleFormDialog
        open={state.editOpen}
        onOpenChange={(open) => {
          if (!open) actions.closeDialogs();
        }}
        title="Edit Role"
        description={`Editing ${state.selectedItem?.name ?? 'role'}.`}
        formData={state.formData}
        onFormChange={actions.setFormData}
        onSubmit={handlers.update}
        submitLabel="Save Changes"
        loading={state.mutating}
      />

      {/* Delete Confirmation */}
      <DeleteConfirmationDialog
        open={state.deleteOpen}
        onOpenChange={(open) => {
          if (!open) actions.closeDialogs();
        }}
        entityType="Role"
        itemName={state.selectedItem?.name ?? ''}
        onConfirm={handlers.delete}
        loading={state.mutating}
      />
    </>
  );
}

export default RolesPage;
