import type { JSX } from 'react';

import type { components } from '@/lib/api/types';

type PaymentStatus = components['schemas']['Payment']['status'];

/**
 * One badge for a payment's status, shared by the operator queue in the
 * backoffice and the customer's own payment log.
 *
 * The wording works for both audiences on purpose: an operator scanning the
 * queue and a customer checking whether their transfer went through are asking
 * the same question. A second copy for the customer side is how the two drift
 * into saying different things about the same row.
 */
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pendiente',
  in_review: 'En revisión',
  approved: 'Aprobado',
  declined: 'Rechazado',
  cancelled: 'Cancelado',
  timeout: 'Expirado',
};

const COLORS: Record<PaymentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_review: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-700',
  timeout: 'bg-orange-100 text-orange-700',
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }): JSX.Element {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${COLORS[status]}`}
    >
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}
