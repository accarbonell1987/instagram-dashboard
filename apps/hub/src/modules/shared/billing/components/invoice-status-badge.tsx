'use client';

import { Badge } from '@core/ui';
import type { JSX } from 'react';

import type { components } from '@/lib/api/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

type InvoiceStatus = components['schemas']['InvoiceStatus'];

// ─── Maps ──────────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  paid: 'Pagada',
  pending: 'Pendiente',
  overdue: 'Vencida',
  cancelled: 'Cancelada',
};

const STATUS_CLASS: Record<InvoiceStatus, string> = {
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  cancelled: 'bg-muted text-muted-foreground',
} satisfies Record<InvoiceStatus, string>;

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps): JSX.Element {
  return (
    <Badge
      variant="secondary"
      className={STATUS_CLASS[status]}
      aria-label={`Estado: ${STATUS_LABEL[status]}`}
    >
      {STATUS_LABEL[status]}
    </Badge>
  );
}
