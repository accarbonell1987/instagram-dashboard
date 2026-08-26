'use client';

import type { JSX, ReactNode } from 'react';

import { cn } from '../../../lib/utils';
import { Button } from '../../atoms/button';

/**
 * The one table in the system.
 *
 * Every screen used to rewrite the same bordered container, muted header, cell
 * padding and row borders, plus its own loading, empty and error branches.
 * Copies drift — that is how one table ended up scrolling sideways while the
 * rest fitted their box, and how two apps ended up with two different table
 * components.
 *
 * The split is deliberate. This owns the frame; the caller writes its own rows
 * with Tr/Td, because cells are genuinely heterogeneous — badges, button
 * clusters, conditional colours, drag handles — and forcing them through a
 * column config would trade real duplication for render props plus an escape
 * hatch for the one table that reorders by dragging.
 *
 * There is no variant prop. A table looks the same wherever it appears; a
 * screen that needs it to look different has a layout problem, not a table
 * problem. A table inside a card is the usual case: give the card no border of
 * its own, or put the heading outside it.
 */

type Align = 'left' | 'right' | 'center';

const ALIGN: Record<Align, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

const STYLE = {
  container: 'border-border overflow-hidden rounded-lg border',
  table: 'w-full text-left text-sm',
  thead: 'bg-muted',
  th: 'px-4 py-3 font-medium',
  td: 'px-4 py-3',
  row: 'border-border border-t',
} as const;

export interface DataTableProps {
  /** Header cells, normally a fragment of <Th> elements. */
  head: ReactNode;
  /** Body rows, normally rows.map(...) producing <Tr> elements. */
  children: ReactNode;
  /**
   * Passed explicitly rather than counted: an empty children array and a
   * children array of empty rows look the same from in here.
   */
  isEmpty: boolean;
  isLoading?: boolean | undefined;
  /** Empty string means no error, matching how the pages already model it. */
  error?: string | undefined;
  loadingText?: string | undefined;
  empty?: { text: string; action?: ReactNode | undefined } | undefined;
  /** Screen-reader description of what the table lists. */
  caption?: string | undefined;
  /** Rows shown while loading, e.g. skeletons, instead of the loading text. */
  loadingRows?: ReactNode | undefined;
  /** Announced while loadingRows are on screen; skeletons say nothing on their own. */
  loadingLabel?: string | undefined;
  /** Extra classes on the <table>, e.g. 'table-fixed'. */
  tableClassName?: string | undefined;
  className?: string | undefined;
}

export function DataTable({
  head,
  children,
  isEmpty,
  isLoading = false,
  error = '',
  loadingText = 'Cargando...',
  empty,
  caption,
  loadingRows,
  loadingLabel,
  tableClassName,
  className,
}: DataTableProps): JSX.Element {
  const frame = (rows: ReactNode, busy = false): JSX.Element => (
    <div
      className={cn(STYLE.container, className)}
      {...(busy
        ? {
            'aria-busy': true,
            ...(loadingLabel !== undefined ? { 'aria-label': loadingLabel } : {}),
          }
        : {})}
    >
      <table className={cn(STYLE.table, tableClassName)}>
        {caption !== undefined && <caption className="sr-only">{caption}</caption>}
        <thead className={STYLE.thead}>
          <tr>{head}</tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );

  // Precedence matters: a failed load also leaves the list empty, and reporting
  // "no hay resultados" for what is actually a broken request sends the reader
  // looking for data that never arrived.
  if (error !== '') {
    return (
      <div
        role="alert"
        className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-6 text-center text-sm"
      >
        {error}
      </div>
    );
  }

  if (isLoading) {
    // Skeleton rows keep the header in place, so the layout does not jump when
    // the real rows arrive.
    if (loadingRows !== undefined) {
      return frame(loadingRows, true);
    }
    return (
      <div className="border-border text-muted-foreground rounded-lg border p-6 text-center text-sm">
        {loadingText}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="border-border rounded-lg border p-8 text-center">
        <p className="text-muted-foreground text-sm">{empty?.text ?? 'No hay resultados.'}</p>
        {empty?.action !== undefined && <div className="mt-2">{empty.action}</div>}
      </div>
    );
  }

  return frame(children);
}

export interface ThProps {
  children?: ReactNode | undefined;
  align?: Align | undefined;
  /** Tailwind width utility, e.g. 'w-24', for columns that must not stretch. */
  width?: string | undefined;
  className?: string | undefined;
  'aria-label'?: string | undefined;
}

export function Th({ children, align = 'left', width, className, ...rest }: ThProps): JSX.Element {
  return (
    <th className={cn(STYLE.th, ALIGN[align], width, className)} {...rest}>
      {children}
    </th>
  );
}

export interface TrProps {
  children: ReactNode;
  /** Skeleton rows are decorative and should not reach the accessibility tree. */
  'aria-hidden'?: boolean | undefined;
  className?: string | undefined;
  /**
   * Makes the whole row activate something — it also gets the pointer and hover
   * affordance, so a clickable row never looks inert.
   */
  onClick?: (() => void) | undefined;
}

export function Tr({ children, className, onClick, ...rest }: TrProps): JSX.Element {
  return (
    <tr
      {...rest}
      className={cn(
        STYLE.row,
        onClick !== undefined && 'hover:bg-muted/50 cursor-pointer transition-colors',
        className
      )}
      {...(onClick !== undefined ? { onClick } : {})}
    >
      {children}
    </tr>
  );
}

export interface TdProps {
  children?: ReactNode | undefined;
  align?: Align | undefined;
  className?: string | undefined;
  colSpan?: number | undefined;
  title?: string | undefined;
}

export function Td({ children, align = 'left', className, ...rest }: TdProps): JSX.Element {
  return (
    <td className={cn(STYLE.td, ALIGN[align], className)} {...rest}>
      {children}
    </td>
  );
}

export interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

/**
 * Renders nothing while everything fits on one page — controls that can only be
 * disabled are noise.
 */
export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
}: TablePaginationProps): JSX.Element | null {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        disabled={page <= 1}
        onClick={() => {
          onPageChange(Math.max(1, page - 1));
        }}
      >
        Anterior
      </Button>
      <span className="text-sm">
        Página {page} de {totalPages}
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => {
          onPageChange(page + 1);
        }}
      >
        Siguiente
      </Button>
    </div>
  );
}
