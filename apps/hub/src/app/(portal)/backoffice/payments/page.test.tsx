import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import PaymentsQueuePage from './page';

import { server } from '@/lib/mocks/server';

// Mock sonner toast (unused directly by this page, but keeps parity with other backoffice pages)
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

const PENDING_PAYMENT = {
  id: 'payment-pending-1',
  tenantId: 'tenant-1',
  tenantName: 'Empresa Acme S.A.',
  method: 'bank_transfer',
  status: 'pending',
  settlementKind: null,
  reference: 'CH-7K2M4Q',
  amount: 450_000,
  currency: 'PYG',
  note: null,
  settledBy: null,
  settledAt: null,
  createdAt: '2026-07-30T12:00:00.000Z',
};

function setupHandlers(overrides?: { confirm?: () => void }) {
  server.use(
    http.get(`${BASE}/admin/payments`, () => {
      return HttpResponse.json({ items: [PENDING_PAYMENT], total: 1, page: 1, pageSize: 20 });
    }),
    http.post(`${BASE}/admin/payments/:id/confirm`, async ({ request }) => {
      const body = (await request.json()) as { note?: string };
      if (body.note === undefined || body.note.trim() === '') {
        return HttpResponse.json(
          { type: 'about:blank', title: 'Validation failed', status: 422, detail: 'payment.note_required' },
          { status: 422, headers: { 'Content-Type': 'application/problem+json' } }
        );
      }
      overrides?.confirm?.();
      return HttpResponse.json({ ...PENDING_PAYMENT, status: 'approved', note: body.note });
    }),
    http.post(`${BASE}/admin/payments/:id/reject`, async ({ request }) => {
      const body = (await request.json()) as { note?: string };
      if (body.note === undefined || body.note.trim() === '') {
        return HttpResponse.json(
          { type: 'about:blank', title: 'Validation failed', status: 422, detail: 'payment.note_required' },
          { status: 422, headers: { 'Content-Type': 'application/problem+json' } }
        );
      }
      return HttpResponse.json({ ...PENDING_PAYMENT, status: 'declined', note: body.note });
    })
  );
}

describe('PaymentsQueuePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders payment rows from the MSW handler', async () => {
    setupHandlers();
    render(<PaymentsQueuePage />);

    expect(await screen.findByText('CH-7K2M4Q')).toBeInTheDocument();
    expect(screen.getByText('Empresa Acme S.A.')).toBeInTheDocument();
    expect(screen.getByText('450,000 PYG')).toBeInTheDocument();
  });

  it('blocks confirm submission until a non-whitespace settlement note is entered', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    setupHandlers({ confirm: onConfirm });
    render(<PaymentsQueuePage />);

    await user.click(await screen.findByRole('button', { name: /confirmar pago/i }));

    const dialog = await screen.findByRole('dialog');
    const submitButton = within(dialog).getByRole('button', { name: 'Confirmar pago' });
    expect(submitButton).toBeDisabled();

    const noteField = within(dialog).getByLabelText(/nota de liquidación/i);
    await user.type(noteField, '   ');
    expect(submitButton).toBeDisabled();

    await user.clear(noteField);
    await user.type(noteField, 'Matched the bank statement');
    expect(submitButton).not.toBeDisabled();

    await user.click(submitButton);
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled();
    });
  });

  it('tells the operator the customer keeps the same reference when rejecting', async () => {
    const user = userEvent.setup();
    setupHandlers();
    render(<PaymentsQueuePage />);

    await user.click(await screen.findByRole('button', { name: /rechazar pago/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/conserva la misma referencia y puede reintentar/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Rechazar pago' })).toBeDisabled();
  });
});
