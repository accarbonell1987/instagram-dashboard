'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@core/ui';
import { useCallback, useEffect, useState, type FormEvent, type JSX } from 'react';

import { ApiError } from '@/lib/api/errors';
import {
  listAdminPayments,
  confirmPayment,
  rejectPayment,
  isSettleable,
  type AdminPayment,
  type AdminPaymentStatus,
} from '@/modules/backoffice/payments';

// ─── Labels ─────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<AdminPaymentStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  declined: 'Declined',
  cancelled: 'Cancelled',
  timeout: 'Timed out',
};

const STATUS_COLORS: Record<AdminPaymentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-700',
  timeout: 'bg-orange-100 text-orange-700',
};

const METHOD_LABELS: Record<string, string> = {
  bancard: 'Bancard',
  bank_transfer: 'Bank transfer',
};

function StatusBadge({ status }: { status: AdminPaymentStatus }): JSX.Element {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function formatAmount(amount: number, currency: string): string {
  return `${amount.toLocaleString()} ${currency}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

// ─── Settlement dialog (confirm/reject, mandatory note) ─────────────────────────

type SettlementAction = 'confirm' | 'reject';

function SettlementDialog({
  payment,
  action,
  onOpenChange,
  onSettled,
}: {
  payment: AdminPayment | null;
  action: SettlementAction;
  onOpenChange: (open: boolean) => void;
  onSettled: () => void;
}): JSX.Element {
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (payment !== null) {
      setNote('');
      setError('');
    }
  }, [payment]);

  const open = payment !== null;
  const noteIsValid = note.trim().length > 0;
  const isConfirm = action === 'confirm';

  async function handleSubmit(): Promise<void> {
    if (payment === null || !noteIsValid) return;
    setIsSaving(true);
    setError('');
    try {
      if (isConfirm) {
        await confirmPayment(payment.id, note.trim());
      } else {
        await rejectPayment(payment.id, note.trim());
      }
      onSettled();
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Could not save the settlement');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isConfirm ? 'Confirm payment' : 'Reject payment'}</DialogTitle>
          <DialogDescription>
            {payment !== null && (
              <>
                Reference <strong>{payment.reference ?? payment.id}</strong> —{' '}
                {formatAmount(payment.amount, payment.currency)}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {!isConfirm && (
          <p className="text-muted-foreground text-sm">
            The customer keeps the same reference and can retry the transfer.
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settlement-note">
            {isConfirm ? 'Settlement note (required)' : 'Rejection reason (required)'}
          </Label>
          <Textarea
            id="settlement-note"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
            }}
            disabled={isSaving}
            placeholder="e.g. amount and date matched the bank statement"
            aria-describedby="settlement-note-hint"
            aria-required="true"
          />
          <p id="settlement-note-hint" className="text-muted-foreground text-xs">
            This becomes the audit record and is what the customer sees in their payment log.
          </p>
        </div>

        {error !== '' && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={isConfirm ? 'default' : 'destructive'}
            onClick={() => void handleSubmit()}
            disabled={isSaving || !noteIsValid}
          >
            {isSaving ? 'Saving...' : isConfirm ? 'Confirm payment' : 'Reject payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PaymentsQueuePage(): JSX.Element {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<AdminPaymentStatus | ''>('pending');
  const [reference, setReference] = useState('');
  const [committedReference, setCommittedReference] = useState('');
  const [actionTarget, setActionTarget] = useState<{
    payment: AdminPayment;
    action: SettlementAction;
  } | null>(null);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listAdminPayments({
        page,
        pageSize,
        status: statusFilter || undefined,
        reference: committedReference || undefined,
      });
      setPayments(result.items);
      setTotal(result.total);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Could not load the payments queue');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, committedReference]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  function handleSearch(e: FormEvent): void {
    e.preventDefault();
    setPage(1);
    setCommittedReference(reference);
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Pending Payments</h2>

      <div className="mb-4 flex flex-wrap gap-2">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Label htmlFor="payments-reference-search" className="sr-only">
            Search by reference
          </Label>
          <Input
            id="payments-reference-search"
            type="text"
            value={reference}
            onChange={(e) => {
              setReference(e.target.value);
            }}
            placeholder="Search by reference..."
            className="w-56"
          />
          <Button type="submit" size="sm" variant="ghost">
            Search
          </Button>
        </form>
        <Select
          value={statusFilter === '' ? 'all' : statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value === 'all' ? '' : (value as AdminPaymentStatus));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(STATUS_LABELS) as AdminPaymentStatus[]).map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error !== '' && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-muted-foreground p-4 text-sm">Loading payments...</p>
      ) : payments.length === 0 ? (
        <div className="border-border bg-card rounded-lg border p-8 text-center">
          <p className="text-muted-foreground text-sm">No payments match this filter.</p>
        </div>
      ) : (
        <>
          <div className="border-border overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Pending payments queue</caption>
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Reference</th>
                  <th className="px-4 py-3 font-medium">Tenant</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-border border-t">
                    <td className="px-4 py-3">{formatDate(payment.createdAt)}</td>
                    <td className="px-4 py-3">{formatAmount(payment.amount, payment.currency)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{payment.reference ?? '—'}</td>
                    <td className="px-4 py-3">{payment.tenantName ?? '—'}</td>
                    <td className="px-4 py-3">{METHOD_LABELS[payment.method] ?? payment.method}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={payment.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isSettleable(payment.status) ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => {
                              setActionTarget({ payment, action: 'confirm' });
                            }}
                            aria-label={`Confirm payment ${payment.reference ?? payment.id}`}
                          >
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setActionTarget({ payment, action: 'reject' });
                            }}
                            aria-label={`Reject payment ${payment.reference ?? payment.id}`}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">{payment.note ?? '—'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1));
                }}
              >
                Previous
              </Button>
              <span className="text-sm">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => {
                  setPage((p) => p + 1);
                }}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <SettlementDialog
        payment={actionTarget?.payment ?? null}
        action={actionTarget?.action ?? 'confirm'}
        onOpenChange={(open) => {
          if (!open) setActionTarget(null);
        }}
        onSettled={() => void loadPayments()}
      />
    </div>
  );
}
