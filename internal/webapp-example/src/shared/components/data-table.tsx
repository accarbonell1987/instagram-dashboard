'use client';

import { Checkbox, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@core/ui';
import { useCallback, useMemo, type ReactNode } from 'react';

export interface DataTableColumn<T> {
  /** Unique key for the column */
  key: string;
  /** Column header label */
  header: string;
  /** Width class (e.g., "w-16", "w-32") */
  width?: string;
  /** Alignment */
  align?: 'left' | 'center' | 'right';
  /** Render function for the cell */
  render: (item: T) => ReactNode;
}

export interface DataTableProps<T> {
  /** Array of items to display */
  items: T[];
  /** Column definitions */
  columns: DataTableColumn<T>[];
  /** Key extractor for each item */
  getRowKey: (item: T) => string;
  /** Whether data is loading */
  loading?: boolean;
  /** Message to show when no items */
  emptyMessage?: string;
  /** Number of columns for loading/empty states */
  columnCount?: number;
  /** Enable row selection with checkboxes */
  selectable?: boolean;
  /** Currently selected row IDs (controlled) */
  selectedIds?: string[];
  /** Callback when selection changes */
  onSelectionChange?: (ids: string[]) => void;
}

export function DataTable<T>({
  items,
  columns,
  getRowKey,
  loading = false,
  emptyMessage = 'No items found.',
  columnCount,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
}: DataTableProps<T>) {
  // Calculate colSpan including checkbox column if selectable
  const baseColSpan = columnCount ?? columns.length;
  const colSpan = selectable ? baseColSpan + 1 : baseColSpan;

  // Get all row IDs for the current page
  const allRowIds = useMemo(() => items.map((item) => getRowKey(item)), [items, getRowKey]);

  // Selection state calculations
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = useMemo(
    () => allRowIds.length > 0 && allRowIds.every((id) => selectedSet.has(id)),
    [allRowIds, selectedSet]
  );
  const someSelected = useMemo(
    () => allRowIds.some((id) => selectedSet.has(id)) && !allSelected,
    [allRowIds, selectedSet, allSelected]
  );

  // Handle select all / deselect all for current page
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (!onSelectionChange) return;

      if (checked) {
        // Add all current page items to selection
        const newSelection = new Set(selectedIds);
        allRowIds.forEach((id) => newSelection.add(id));
        onSelectionChange(Array.from(newSelection));
      } else {
        // Remove all current page items from selection
        const newSelection = selectedIds.filter((id) => !allRowIds.includes(id));
        onSelectionChange(newSelection);
      }
    },
    [onSelectionChange, selectedIds, allRowIds]
  );

  // Handle individual row selection toggle
  const handleRowSelect = useCallback(
    (rowId: string, checked: boolean) => {
      if (!onSelectionChange) return;

      if (checked) {
        onSelectionChange([...selectedIds, rowId]);
      } else {
        onSelectionChange(selectedIds.filter((id) => id !== rowId));
      }
    },
    [onSelectionChange, selectedIds]
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {selectable && (
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={(checked) => {
                  handleSelectAll(checked === true);
                }}
                aria-label="Select all rows"
              />
            </TableHead>
          )}
          {columns.map((column) => (
            <TableHead
              key={column.key}
              className={`${column.width ?? ''} ${column.align === 'right' ? 'text-right' : ''}`}
            >
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableRow>
            <TableCell colSpan={colSpan} className="text-muted-foreground h-32 text-center">
              Loading...
            </TableCell>
          </TableRow>
        ) : items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={colSpan} className="text-muted-foreground h-32 text-center">
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          items.map((item) => {
            const rowId = getRowKey(item);
            const isSelected = selectedSet.has(rowId);

            return (
              <TableRow key={rowId} data-state={isSelected ? 'selected' : undefined}>
                {selectable && (
                  <TableCell className="w-12">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        handleRowSelect(rowId, checked === true);
                      }}
                      aria-label={`Select row ${rowId}`}
                    />
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={column.align === 'right' ? 'text-right' : ''}
                  >
                    {column.render(item)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
