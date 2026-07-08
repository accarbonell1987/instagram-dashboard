'use client';

import type { CrudService, PaginatedResponse } from '@core/core/services';
import { useCallback, useEffect, useState } from 'react';

import { useDebouncedValue } from './use-debounced-value';

// ─── Types ─────────────────────────────────────────────

export interface UseCrudPageOptions<T extends { id: string | number }, TCreate, TUpdate> {
  /** The CRUD service to use for data operations */
  service: CrudService<T, TCreate, TUpdate>;
  /** Number of items per page */
  pageSize?: number;
  /** Debounce delay for search in milliseconds */
  searchDebounce?: number;
}

export interface CrudPageState<T, TFormData> {
  /** Current items */
  items: T[];
  /** Total count of items */
  total: number;
  /** Current page number (1-indexed) */
  page: number;
  /** Total number of pages */
  totalPages: number;
  /** Search query */
  search: string;
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Create dialog open state */
  createOpen: boolean;
  /** Edit dialog open state */
  editOpen: boolean;
  /** Delete dialog open state */
  deleteOpen: boolean;
  /** Currently selected item for edit/delete */
  selectedItem: T | null;
  /** Form data */
  formData: TFormData;
  /** Whether a mutation is in progress */
  mutating: boolean;
}

export interface CrudPageActions<T, TFormData> {
  /** Set search query (resets to page 1) */
  setSearch: (search: string) => void;
  /** Go to a specific page */
  setPage: (page: number) => void;
  /** Go to previous page */
  previousPage: () => void;
  /** Go to next page */
  nextPage: () => void;
  /** Open create dialog */
  openCreate: () => void;
  /** Open edit dialog with item */
  openEdit: (item: T, formData: TFormData) => void;
  /** Open delete confirmation dialog */
  openDelete: (item: T) => void;
  /** Close all dialogs */
  closeDialogs: () => void;
  /** Update form data */
  setFormData: (data: TFormData) => void;
  /** Refresh data */
  refresh: () => Promise<void>;
  /** Clear error */
  clearError: () => void;
}

export interface CrudOperations<TCreate, TUpdate> {
  /** Create a new item */
  create: (data: TCreate) => Promise<boolean>;
  /** Update an item */
  update: (id: string, data: TUpdate) => Promise<boolean>;
  /** Delete an item */
  remove: (id: string) => Promise<boolean>;
}

export interface UseCrudPageReturn<T, TFormData, TCreate, TUpdate> {
  state: CrudPageState<T, TFormData>;
  actions: CrudPageActions<T, TFormData>;
  operations: CrudOperations<TCreate, TUpdate>;
}

// ─── Hook ──────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 5;
const DEFAULT_SEARCH_DEBOUNCE = 300;

export function useCrudPage<T extends { id: string | number }, TFormData, TCreate, TUpdate>(
  options: UseCrudPageOptions<T, TCreate, TUpdate>,
  emptyFormData: TFormData
): UseCrudPageReturn<T, TFormData, TCreate, TUpdate> {
  const {
    service,
    pageSize = DEFAULT_PAGE_SIZE,
    searchDebounce = DEFAULT_SEARCH_DEBOUNCE,
  } = options;

  // ─── State ─────────────────────────────────────────

  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<T | null>(null);
  const [formData, setFormData] = useState<TFormData>(emptyFormData);

  // Debounced search
  const debouncedSearch = useDebouncedValue(search, searchDebounce);

  // ─── Data Fetching ─────────────────────────────────

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filterParams: Parameters<typeof service.filter>[0] = {
        page,
        pageSize,
      };
      if (debouncedSearch) filterParams.search = debouncedSearch;
      const result: PaginatedResponse<T> = await service.filter(filterParams);
      setItems(result.data);
      setTotal(result.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(message);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [service, page, pageSize, debouncedSearch]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // ─── Computed Values ───────────────────────────────

  const totalPages = Math.ceil(total / pageSize);

  // ─── Actions ───────────────────────────────────────

  const handleSetSearch = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const handleSetPage = useCallback(
    (value: number) => {
      setPage(Math.max(1, Math.min(value, totalPages || 1)));
    },
    [totalPages]
  );

  const previousPage = useCallback(() => {
    setPage((prev) => Math.max(1, prev - 1));
  }, []);

  const nextPage = useCallback(() => {
    setPage((prev) => Math.min(totalPages, prev + 1));
  }, [totalPages]);

  const openCreate = useCallback(() => {
    setFormData(emptyFormData);
    setSelectedItem(null);
    setCreateOpen(true);
  }, [emptyFormData]);

  const openEdit = useCallback((item: T, itemFormData: TFormData) => {
    setSelectedItem(item);
    setFormData(itemFormData);
    setEditOpen(true);
  }, []);

  const openDelete = useCallback((item: T) => {
    setSelectedItem(item);
    setDeleteOpen(true);
  }, []);

  const closeDialogs = useCallback(() => {
    setCreateOpen(false);
    setEditOpen(false);
    setDeleteOpen(false);
    setSelectedItem(null);
    setFormData(emptyFormData);
  }, [emptyFormData]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ─── CRUD Operations ───────────────────────────────

  const create = useCallback(
    async (data: TCreate): Promise<boolean> => {
      setMutating(true);
      setError(null);
      try {
        await service.create(data);
        setCreateOpen(false);
        setFormData(emptyFormData);
        void fetchItems();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create';
        setError(message);
        return false;
      } finally {
        setMutating(false);
      }
    },
    [service, emptyFormData, fetchItems]
  );

  const update = useCallback(
    async (id: string, data: TUpdate): Promise<boolean> => {
      setMutating(true);
      setError(null);
      try {
        await service.update(id, data);
        setEditOpen(false);
        setSelectedItem(null);
        setFormData(emptyFormData);
        void fetchItems();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update';
        setError(message);
        return false;
      } finally {
        setMutating(false);
      }
    },
    [service, emptyFormData, fetchItems]
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      setMutating(true);
      setError(null);
      try {
        await service.remove(id);
        setDeleteOpen(false);
        setSelectedItem(null);
        void fetchItems();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete';
        setError(message);
        return false;
      } finally {
        setMutating(false);
      }
    },
    [service, fetchItems]
  );

  // ─── Return ────────────────────────────────────────

  return {
    state: {
      items,
      total,
      page,
      totalPages,
      search,
      loading,
      error,
      createOpen,
      editOpen,
      deleteOpen,
      selectedItem,
      formData,
      mutating,
    },
    actions: {
      setSearch: handleSetSearch,
      setPage: handleSetPage,
      previousPage,
      nextPage,
      openCreate,
      openEdit,
      openDelete,
      closeDialogs,
      setFormData,
      refresh: fetchItems,
      clearError,
    },
    operations: {
      create,
      update,
      remove,
    },
  };
}
