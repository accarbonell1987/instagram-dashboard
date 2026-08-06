import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import TenantsPage from './page';

import { server } from '@/lib/mocks/server';

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

const PENDING_TENANT = {
  id: 'tenant-1',
  name: 'Empresa Acme S.A.',
  slug: 'acme',
  status: 'pending',
  planId: 'plan-1',
  planName: 'Enterprise',
  userCount: 3,
  createdAt: '2026-07-01T00:00:00.000Z',
};

const PENDING_TENANT_DETAIL = {
  ...PENDING_TENANT,
  plan: { id: 'plan-1', name: 'Enterprise', price: 299.99, currency: 'PYG', billingInterval: 'month' },
  updatedAt: '2026-07-01T00:00:00.000Z',
};

function setupHandlers(overrides?: { onStatusChange?: (body: { status?: string; note?: string }) => void }) {
  server.use(
    http.get(`${BASE}/admin/tenants`, () => {
      return HttpResponse.json({ items: [PENDING_TENANT], total: 1, page: 1, pageSize: 20 });
    }),
    http.get(`${BASE}/admin/tenants/:id`, () => {
      return HttpResponse.json(PENDING_TENANT_DETAIL);
    }),
    http.get(`${BASE}/admin/tenants/:id/payments`, () => {
      return HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20 });
    }),
    http.patch(`${BASE}/admin/tenants/:id/status`, async ({ request }) => {
      const body = (await request.json()) as { status?: string; note?: string };
      overrides?.onStatusChange?.(body);
      if (body.status === 'active' && (body.note === undefined || body.note.trim() === '')) {
        return HttpResponse.json(
          { type: 'about:blank', title: 'Validation failed', status: 422, detail: 'payment.note_required' },
          { status: 422, headers: { 'Content-Type': 'application/problem+json' } }
        );
      }
      return HttpResponse.json({ id: 'tenant-1', status: body.status });
    })
  );
}

describe('TenantsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks activation submission until a non-whitespace note is entered', async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();
    setupHandlers({ onStatusChange });
    render(<TenantsPage />);

    await user.click(await screen.findByText('Empresa Acme S.A.'));
    await user.click(await screen.findByRole('button', { name: 'Activar' }));

    const dialog = await screen.findByRole('dialog');
    const submitButton = within(dialog).getByRole('button', { name: 'Activar' });
    expect(submitButton).toBeDisabled();

    const noteField = within(dialog).getByLabelText(/nota de activación/i);
    await user.type(noteField, '   ');
    expect(submitButton).toBeDisabled();
    expect(onStatusChange).not.toHaveBeenCalled();

    await user.clear(noteField);
    await user.type(noteField, 'Courtesy activation, confirmed by phone');
    expect(submitButton).not.toBeDisabled();

    await user.click(submitButton);
    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith({
        status: 'active',
        note: 'Courtesy activation, confirmed by phone',
      });
    });
  });

  it('activates and closes the dialog once the backend accepts the note', async () => {
    const user = userEvent.setup();
    setupHandlers();
    render(<TenantsPage />);

    await user.click(await screen.findByText('Empresa Acme S.A.'));
    await user.click(await screen.findByRole('button', { name: 'Activar' }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/nota de activación/i), 'Payment matched the bank statement');
    await user.click(within(dialog).getByRole('button', { name: 'Activar' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('suspends without requiring a note', async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();
    setupHandlers({ onStatusChange });
    render(<TenantsPage />);

    await user.click(await screen.findByText('Empresa Acme S.A.'));
    await user.click(await screen.findByRole('button', { name: 'Suspender' }));

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith({ status: 'suspended' });
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
