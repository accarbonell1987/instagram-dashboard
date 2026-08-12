import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, it, expect } from 'vitest';

import { PaymentsSection } from './payments-section';

import { server } from '@/lib/mocks/server';

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

function payment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pay-1',
    tenantId: 'tenant-1',
    method: 'bank_transfer',
    status: 'approved',
    settlementKind: 'agent',
    reference: 'CH-7K2M4Q',
    amount: 50000,
    currency: 'PYG',
    note: 'El monto coincide con el extracto bancario',
    settledBy: 'admin-uuid-1',
    settledAt: '2026-08-12T19:18:10.000Z',
    instruction: null,
    createdAt: '2026-08-12T19:17:46.000Z',
    ...overrides,
  };
}

function respondWith(items: Record<string, unknown>[]) {
  server.use(
    http.get(`${BASE}/billing/payments`, () =>
      HttpResponse.json({ items, total: items.length, page: 1, pageSize: 20 })
    )
  );
}

describe('PaymentsSection', () => {
  it('lists what was paid, when, and how', async () => {
    respondWith([payment()]);
    render(<PaymentsSection />);

    expect(await screen.findByText('12/08/2026')).toBeInTheDocument();
    expect(screen.getByText('50.000 PYG')).toBeInTheDocument();
    expect(screen.getByText('Transferencia bancaria')).toBeInTheDocument();
    expect(screen.getByText('CH-7K2M4Q')).toBeInTheDocument();
    expect(screen.getByText('Aprobado')).toBeInTheDocument();
  });

  /**
   * The settlement note is written for the customer — it is what the agent saw,
   * or why the payment was refused — so it belongs on their screen.
   */
  it('shows the settlement note and how the payment was settled', async () => {
    respondWith([payment()]);
    render(<PaymentsSection />);

    expect(await screen.findByText(/coincide con el extracto/)).toBeInTheDocument();
    expect(screen.getByText('Verificado por nuestro equipo')).toBeInTheDocument();
  });

  /**
   * The API returns settledBy — the id of the admin who settled it. That is an
   * internal detail: the tenant needs to know a human reviewed their payment,
   * not which employee it was.
   */
  it('never shows which operator settled the payment', async () => {
    respondWith([payment()]);
    render(<PaymentsSection />);

    await screen.findByText('Aprobado');
    expect(screen.queryByText(/admin-uuid-1/)).toBeNull();
  });

  it('says so when there are no payments yet', async () => {
    respondWith([]);
    render(<PaymentsSection />);

    expect(await screen.findByText('Todavía no registramos ningún pago.')).toBeInTheDocument();
  });

  it('reports a failed load instead of pretending the history is empty', async () => {
    server.use(
      http.get(`${BASE}/billing/payments`, () =>
        HttpResponse.json(
          { type: 'about:blank', title: 'Server error', status: 500 },
          { status: 500, headers: { 'Content-Type': 'application/problem+json' } }
        )
      )
    );
    render(<PaymentsSection />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/No pudimos cargar tus pagos/);
    expect(screen.queryByText('Todavía no registramos ningún pago.')).toBeNull();
  });

  it('marks the list busy while it loads', async () => {
    respondWith([payment()]);
    const { container } = render(<PaymentsSection />);

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    await waitFor(() => {
      expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    });
  });
});
