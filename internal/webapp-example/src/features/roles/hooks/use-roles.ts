'use client';


import { EMPTY_FORM, PAGE_SIZE } from '../roles.constants';
import { toRoleCreate, toRoleFormData, toRoleUpdate } from '../roles.types';
import type { Role, RoleFormData } from '../roles.types';

import { useDomainServices } from '@/hooks/useDomainServices';
import { useCrudPage } from '@/shared/hooks';

/**
 * Hook for managing roles CRUD operations.
 * Wraps useCrudPage with role-specific configuration.
 */
export function useRoles() {
  const { roles: rolesService } = useDomainServices();

  const crud = useCrudPage<
    Role,
    RoleFormData,
    Parameters<typeof rolesService.create>[0],
    Parameters<typeof rolesService.update>[1]
  >(
    {
      service: rolesService,
      pageSize: PAGE_SIZE,
    },
    EMPTY_FORM
  );

  // Wrap operations with form data conversion
  const handleCreate = async () => {
    const createData = toRoleCreate(crud.state.formData);
    return crud.operations.create(createData);
  };

  const handleUpdate = async () => {
    if (!crud.state.selectedItem) return false;
    const updateData = toRoleUpdate(crud.state.formData);
    return crud.operations.update(crud.state.selectedItem.id, updateData);
  };

  const handleDelete = async () => {
    if (!crud.state.selectedItem) return false;
    return crud.operations.remove(crud.state.selectedItem.id);
  };

  const openEdit = (role: Role) => {
    crud.actions.openEdit(role, toRoleFormData(role));
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

export type UseRolesReturn = ReturnType<typeof useRoles>;
