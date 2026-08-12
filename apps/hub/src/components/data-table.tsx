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
 * How the frame is drawn. Carried by context so the header and body cells of one
 * table cannot disagree, and so a caller sets it once instead of repeating it on
 * every Th and Td — which is the copy-paste this component exists to remove.
 *
 * - default: bordered container, filled header. Standalone backoffice screens.
 * - dense:   the same frame with tighter gutters, for many-column tables.
 * - bare:    no container, no filled header, no boxed empty state. For tables
 *            already inside a settings card, where a bordered frame would draw
 *            a box inside a box.
 */
export type DataTableVariant = 'default' | 'dense' | 'bare';

interface VariantStyle {
  container: string;
  table: string;
  thead: string;
  headRow: string;
  th: string;
  td: string;
  row: string;
  /** Bare tables report their states as plain text, matching their surroundings. */
  boxedStates: boolean;
}

const VARIANTS: Record<DataTableVariant, VariantStyle> = {
  default: {
    container: 'border-border overflow-hidden rounded-lg border',
    table: 'w-full text-left text-sm',
    thead: 'bg-muted',
    headRow: '',
    th: 'px-4 py-3 font-medium',
    td: 'px-4 py-3',
    row: 'border-border border-t',
    boxedStates: true,
  },
  dense: {
    container: 'border-border overflow-hidden rounded-lg border',
    table: 'w-full text-left text-sm',
    thead: 'bg-muted',
    headRow: '',
    th: 'px-3 py-3 font-medium',
    td: 'px-3 py-3',
    row: 'border-border border-t',
    boxedStates: true,
  },
  bare: {
    container: 'overflow-x-auto',
    table: 'w-full text-sm',
    thead: '',
    headRow: 'border-border border-b',
    // The trailing gutter is dropped on the last column so the row ends flush
    // with the card that contains it.
    th: 'text-muted-foreground py-2 pr-4 last:pr-0 font-medium',
    td: 'py-3 pr-4 last:pr-0',
    row: 'border-border border-b last:border-0',
    boxedStates: false,
  },
};

const VariantContext = createContext<DataTableVariant>('default');

function useVariantStyle(): VariantStyle {
  return VARIANTS[useContext(VariantContext)];
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
  variant?: DataTableVariant | undefined;
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
  variant = 'default',
  loadingRows,
  loadingLabel,
  tableClassName,
  className,
}: DataTableProps): JSX.Element {
  const style = VARIANTS[variant];

  const frame = (rows: ReactNode, busy = false): JSX.Element => (
    <VariantContext.Provider value={variant}>
      <div
        className={cn(style.container, className)}
        {...(busy
          ? { 'aria-busy': true, ...(loadingLabel !== undefined ? { 'aria-label': loadingLabel } : {}) }
          : {})}
      >
        <table className={cn(style.table, tableClassName)}>
          {caption !== undefined && <caption className="sr-only">{caption}</caption>}
          <thead className={style.thead}>
            <tr className={style.headRow}>{head}</tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </VariantContext.Provider>
  );
  // Precedence matters: a failed load leaves the list empty, and reporting
  // "no hay resultados" for what is actually a broken request sends the
  // operator looking for data that never arrived.
  if (error !== '') {
    return style.boxedStates ? (
      <div
        role="alert"
        className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-6 text-center text-sm"
      >
        {error}
      </div>
    ) : (
      <p role="alert" className="text-destructive text-sm">
        {error}
      </p>
    );
  }

  if (isLoading) {
    // A skeleton keeps the header in place, so the layout does not jump when
    // the rows arrive.
    if (loadingRows !== undefined) {
      return frame(loadingRows, true);
    }
    return style.boxedStates ? (
      <div className="border-border text-muted-foreground rounded-lg border p-6 text-center text-sm">
        {loadingText}
      </div>
    ) : (
      <p className="text-muted-foreground py-4 text-sm">{loadingText}</p>
    );
  }

  if (isEmpty) {
    const text = empty?.text ?? 'No hay resultados.';
    return style.boxedStates ? (
      <div className="border-border rounded-lg border p-8 text-center">
        <p className="text-muted-foreground text-sm">{text}</p>
        {empty?.action !== undefined && <div className="mt-2">{empty.action}</div>}
      </div>
    ) : (
      <p className="text-muted-foreground py-4 text-sm">{text}</p>
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

export function Th({
  children,
  align = 'left',
  width,
  className,
  ...rest
}: ThProps): JSX.Element {
  return (
    <th
      className={cn(useVariantStyle().th, ALIGN[align], width, className)}
      {...rest}
    >
      {children}
    </th>
  );
}

export interface TrProps {
  children: ReactNode;
  /** Skeleton rows are decorative and should not reach the accessibility tree. */
  'aria-hidden'?: boolean | undefined;
  className?: string | undefined;
  /** Makes the whole row activate something — it also gets the pointer and
   *  hover affordance, so a clickable row never looks inert. */
  onClick?: (() => void) | undefined;
}

export function Tr({ children, className, onClick, ...rest }: TrProps): JSX.Element {
  return (
    <tr
      {...rest}
      className={cn(
        useVariantStyle().row,
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
    <td className={cn(useVariantStyle().td, ALIGN[align], className)} {...rest}>
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
