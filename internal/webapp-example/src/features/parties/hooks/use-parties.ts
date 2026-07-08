'use client';


import { EMPTY_FORM, PAGE_SIZE } from '../parties.constants';
import { toPartyCreate, toPartyFormData, toPartyUpdate } from '../parties.types';
import type { Party, PartyFormData } from '../parties.types';

import { useDomainServices } from '@/hooks/useDomainServices';
import { useCrudPage } from '@/shared/hooks';

/**
 * Hook for managing parties CRUD operations.
 * Wraps useCrudPage with party-specific configuration.
 */
export function useParties() {
  const { parties: partiesService } = useDomainServices();

  const crud = useCrudPage<
    Party,
    PartyFormData,
    Parameters<typeof partiesService.create>[0],
    Parameters<typeof partiesService.update>[1]
  >(
    {
      service: partiesService,
      pageSize: PAGE_SIZE,
    },
    EMPTY_FORM
  );

  // Wrap operations with form data conversion
  const handleCreate = async () => {
    const createData = toPartyCreate(crud.state.formData);
    return crud.operations.create(createData);
  };

  const handleUpdate = async () => {
    if (!crud.state.selectedItem) return false;
    const updateData = toPartyUpdate(crud.state.formData);
    return crud.operations.update(crud.state.selectedItem.id, updateData);
  };

  const handleDelete = async () => {
    if (!crud.state.selectedItem) return false;
    return crud.operations.remove(crud.state.selectedItem.id);
  };

  const openEdit = (party: Party) => {
    crud.actions.openEdit(party, toPartyFormData(party));
  };

  return {
    ...crud,
    handlers: {
      create: handleCreate,
      update: handleUpdate,
      delete: handleDelete,
      openEdit,
    },
  };
}

export type UsePartiesReturn = ReturnType<typeof useParties>;
