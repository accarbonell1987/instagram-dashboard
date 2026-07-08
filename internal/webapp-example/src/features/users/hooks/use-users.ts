'use client';

import type { BatchCreateResult, BatchDeleteResult } from '@core/core/services';
import { useCallback, useEffect, useRef, useState } from 'react';

import { EMPTY_FORM, PAGE_SIZE } from '../users.constants';
import { toUserCreate, toUserFormData, toUserUpdate } from '../users.types';
import type { User, UserFormData } from '../users.types';

import { useDomainServices } from '@/hooks/useDomainServices';
import { useCrudPage } from '@/shared/hooks';
import type { BatchCreateUsersInput } from '@/types/entities';

// ─── Selection State Types ─────────────────────────────

export interface SelectionState {
  /** Currently selected row IDs */
  selectedIds: string[];
  /** Set selected IDs (replaces current selection) */
  setSelectedIds: (ids: string[]) => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Toggle selection for a single item */
  toggleSelection: (id: string) => void;
  /** Select all items (accepts array of IDs to select) */
  selectAll: (ids: string[]) => void;
}

// ─── Batch Operations Types ────────────────────────────

export interface BatchOperations {
  /** Create multiple users at once */
  batchCreate: (data: BatchCreateUsersInput) => Promise<BatchCreateResult<User>>;
  /** Delete all selected users */
  batchDelete: () => Promise<BatchDeleteResult>;
  /** Assign a role to a specific user */
  assignRole: (userId: string, roleId: string) => Promise<boolean>;
  /** Associate a user with a person (party) */
  assignPerson: (userId: string, partyId: string) => Promise<boolean>;
}

// ─── Loading States Types ──────────────────────────────

export interface BatchLoadingStates {
  /** Loading state for batch create operation */
  batchCreating: boolean;
  /** Loading state for batch delete operation */
  batchDeleting: boolean;
  /** Loading state for role/person assignment operations */
  assigning: boolean;
}

/**
 * Hook for managing users CRUD operations.
 * Wraps useCrudPage with user-specific configuration.
 *
 * Extended with:
 * - Selection state management for batch operations
 * - Batch create/delete operations
 * - Role and person assignment operations
 */
export function useUsers() {
  const { users: usersService } = useDomainServices();

  const crud = useCrudPage<
    User,
    UserFormData,
    Parameters<typeof usersService.create>[0],
    Parameters<typeof usersService.update>[1]
  >(
    {
      service: usersService,
      pageSize: PAGE_SIZE,
    },
    EMPTY_FORM
  );

  // ─── Selection State ─────────────────────────────────

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, []);

  // Track previous page and search to detect changes
  const prevPageRef = useRef(crud.state.page);
  const prevSearchRef = useRef(crud.state.search);

  // Auto-clear selection on pagination or search changes
  useEffect(() => {
    const pageChanged = prevPageRef.current !== crud.state.page;
    const searchChanged = prevSearchRef.current !== crud.state.search;

    if (pageChanged || searchChanged) {
      clearSelection();
    }

    prevPageRef.current = crud.state.page;
    prevSearchRef.current = crud.state.search;
  }, [crud.state.page, crud.state.search, clearSelection]);

  const selection: SelectionState = {
    selectedIds,
    setSelectedIds,
    clearSelection,
    toggleSelection,
    selectAll,
  };

  // ─── Batch Loading States ────────────────────────────

  const [batchCreating, setBatchCreating] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const batchLoading: BatchLoadingStates = {
    batchCreating,
    batchDeleting,
    assigning,
  };

  // ─── Batch Operations ────────────────────────────────

  const batchCreate = useCallback(
    async (data: BatchCreateUsersInput): Promise<BatchCreateResult<User>> => {
      setBatchCreating(true);
      try {
        const result = await usersService.batchCreate(data);
        // Refresh list after successful batch create
        await crud.actions.refresh();
        return result;
      } finally {
        setBatchCreating(false);
      }
    },
    [usersService, crud.actions]
  );

  const batchDelete = useCallback(async (): Promise<BatchDeleteResult> => {
    if (selectedIds.length === 0) {
      return { deleted: 0 };
    }

    setBatchDeleting(true);
    try {
      const result = await usersService.batchDelete({ ids: selectedIds });
      // Clear selection and refresh after successful batch delete
      clearSelection();
      await crud.actions.refresh();
      return result;
    } finally {
      setBatchDeleting(false);
    }
  }, [usersService, selectedIds, clearSelection, crud.actions]);

  const assignRole = useCallback(
    async (userId: string, roleId: string): Promise<boolean> => {
      setAssigning(true);
      try {
        await usersService.assignRole(userId, { roleId });
        await crud.actions.refresh();
        return true;
      } catch {
        return false;
      } finally {
        setAssigning(false);
      }
    },
    [usersService, crud.actions]
  );

  const assignPerson = useCallback(
    async (userId: string, partyId: string): Promise<boolean> => {
      setAssigning(true);
      try {
        await usersService.assignPerson(userId, { partyId });
        await crud.actions.refresh();
        return true;
      } catch {
        return false;
      } finally {
        setAssigning(false);
      }
    },
    [usersService, crud.actions]
  );

  const batchOperations: BatchOperations = {
    batchCreate,
    batchDelete,
    assignRole,
    assignPerson,
  };

  // ─── Original CRUD Handlers ──────────────────────────

  const handleCreate = async () => {
    const createData = toUserCreate(crud.state.formData);
    return crud.operations.create(createData);
  };

  const handleUpdate = async () => {
    if (!crud.state.selectedItem) return false;
    const updateData = toUserUpdate(crud.state.formData);
    return crud.operations.update(crud.state.selectedItem.id, updateData);
  };

  const handleDelete = async () => {
    if (!crud.state.selectedItem) return false;
    return crud.operations.remove(crud.state.selectedItem.id);
  };

  const openEdit = (user: User) => {
    crud.actions.openEdit(user, toUserFormData(user));
  };

  return {
    ...crud,
    handlers: {
      create: handleCreate,
      update: handleUpdate,
      delete: handleDelete,
      openEdit,
    },
    // New selection and batch operation support
    selection,
    batchOperations,
    batchLoading,
  };
}

export type UseUsersReturn = ReturnType<typeof useUsers>;
