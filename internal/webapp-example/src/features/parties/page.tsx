'use client';

import { BuildingIcon } from 'lucide-react';


import { PartiesTable } from './components/parties-table';
import { PartyFormDialog } from './components/party-form-dialog';
import { useParties } from './hooks/use-parties';

import {
  CrudPageLayout,
  DeleteConfirmationDialog,
  Pagination,
  SearchInput,
} from '@/shared/components';

/**
 * Parties page component using Screaming Architecture.
 * All party-specific code is co-located in this feature module.
 */
export function PartiesPage() {
  const { state, actions, handlers } = useParties();

  return (
    <>
      <CrudPageLayout
        icon={<BuildingIcon className="h-8 w-8" />}
        title="Parties"
        description="Manage persons and organizations with centralized domain services"
        total={state.total}
        countLabel="parties"
        createLabel="New Party"
        onCreateClick={actions.openCreate}
        error={state.error}
        onClearError={actions.clearError}
        searchInput={
          <SearchInput
            value={state.search}
            onChange={actions.setSearch}
            placeholder="Search by name, email, or phone..."
            label="Search parties"
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
        <PartiesTable
          parties={state.items}
          loading={state.loading}
          onEdit={handlers.openEdit}
          onDelete={actions.openDelete}
        />
      </CrudPageLayout>

      {/* Create Dialog */}
      <PartyFormDialog
        open={state.createOpen}
        onOpenChange={(open) => {
          if (!open) actions.closeDialogs();
        }}
        title="Create Party"
        description="Add a new person or organization."
        formData={state.formData}
        onFormChange={actions.setFormData}
        onSubmit={handlers.create}
        submitLabel="Create"
        loading={state.mutating}
      />

      {/* Edit Dialog */}
      <PartyFormDialog
        open={state.editOpen}
        onOpenChange={(open) => {
          if (!open) actions.closeDialogs();
        }}
        title="Edit Party"
        description={`Editing ${state.selectedItem?.displayName ?? 'party'}.`}
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
        entityType="Party"
        itemName={state.selectedItem?.displayName ?? ''}
        onConfirm={handlers.delete}
        loading={state.mutating}
      />
    </>
  );
}

export default PartiesPage;
