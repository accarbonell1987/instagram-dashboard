'use client';

import { Button, cn } from '@core/ui';
import { createContext, useContext, type JSX, type ReactNode } from 'react';

/**
 * The chrome every backoffice table was rewriting by hand.
 *
 * Nine screens each declared the same bordered container, the same muted
 * header, the same cell padding and row borders, and their own loading, empty
 * and error branches — and two of them carried a byte-identical pagination
 * block. Copies drift: that is how one table ended up scrolling horizontally
 * while the rest fitted their box.
 *
 * The split is deliberate. This owns the frame; the caller still writes its own
 * rows with Tr/Td, because the cells are genuinely heterogeneous — badges,
 * button clusters, conditional colours, drag handles — and forcing them through
 * a column config would trade real duplication for render props plus an escape
 * hatch for the one table that reorders by dragging.
 */

type Align = 'left' | 'right' | 'center';

const ALIGN: Record<Align, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

/**
 * Cell padding, shared by the header and body cells of one table so a caller
 * cannot end up with a dense header over roomy rows. Context rather than a prop
 * on every cell: the choice belongs to the table, and threading it through
 * every Th and Td is exactly the copy-paste this component exists to remove.
 */
const DensityContext = createContext<'normal' | 'dense'>('normal');

const PADDING: Record<'normal' | 'dense', string> = {
  normal: 'px-4 py-3',
  // Seven columns and a fixed layout leave no room for the wider gutter.
  dense: 'px-3 py-3',
};

function useCellPadding(): string {
  return PADDING[useContext(DensityContext)];
}

export interface DataTableProps {
  /** Header cells, normally a fragment of <Th> elements. */
  head: ReactNode;
  /** Body rows, normally rows.map(...) producing <Tr> elements. */
  children: ReactNode;
  /** Passed explicitly rather than counted: an empty children array and a
   *  children array of empty rows look the same from in here. */
  isEmpty: boolean;
  isLoading?: boolean | undefined;
  /** Empty string means no error, matching how the pages already model it. */
  error?: string | undefined;
  loadingText?: string | undefined;
  empty?: { text: string; action?: ReactNode | undefined } | undefined;
  /** Screen-reader description of what the table lists. */
  caption?: string | undefined;
  /** Tighter gutters for tables with many columns. */
  density?: 'normal' | 'dense' | undefined;
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
  density = 'normal',
  tableClassName,
  className,
}: DataTableProps): JSX.Element {
  // Precedence matters: a failed load leaves the list empty, and reporting
  // "no hay resultados" for what is actually a broken request sends the
  // operator looking for data that never arrived.
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

  return (
    <DensityContext.Provider value={density}>
      <div className={cn('border-border overflow-hidden rounded-lg border', className)}>
        <table className={cn('w-full text-left text-sm', tableClassName)}>
          {caption !== undefined && <caption className="sr-only">{caption}</caption>}
          <thead className="bg-muted">
            <tr>{head}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </DensityContext.Provider>
  );
}

export interface ThProps {
  children?: ReactNode | undefined;
  align?: Align | undefined;
  /** Tailwind width utility, e.g. 'w-24', for columns that must not stretch. */
  width?: string | undefined;
  className?: string | undefined;
  'aria-label'?: string | undefined;
}

export function Th({
  children,
  align = 'left',
  width,
  className,
  ...rest
}: ThProps): JSX.Element {
  return (
    <th
      className={cn(useCellPadding(), 'font-medium', ALIGN[align], width, className)}
      {...rest}
    >
      {children}
    </th>
  );
}

export interface TrProps {
  children: ReactNode;
  className?: string | undefined;
  /** Makes the whole row activate something — it also gets the pointer and
   *  hover affordance, so a clickable row never looks inert. */
  onClick?: (() => void) | undefined;
}

export function Tr({ children, className, onClick }: TrProps): JSX.Element {
  return (
    <tr
      className={cn(
        'border-border border-t',
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
    <td className={cn(useCellPadding(), ALIGN[align], className)} {...rest}>
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
 * Renders nothing while everything fits on one page — the pages this replaces
 * all guarded on `totalPages > 1`, and controls that can only be disabled are
 * noise.
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
