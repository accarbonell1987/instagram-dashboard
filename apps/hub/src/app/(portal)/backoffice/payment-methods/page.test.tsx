import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import PaymentMethodsPage from './page';

import { server } from '@/lib/mocks/server';

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => {
      toastSuccess(...args);
    },
    error: (...args: unknown[]) => {
      toastError(...args);
    },
  },
}));

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

function setupHandlers() {
  server.use(
    http.get(`${BASE}/admin/payment-methods`, () => {
      return HttpResponse.json({
        items: [
          { method: 'bancard', enabled: true },
          { method: 'bank_transfer', enabled: false },
        ],
      });
    }),
    http.patch(`${BASE}/admin/payment-methods/:method`, async ({ params, request }) => {
      const method = params['method'] as string;
      const body = (await request.json()) as { enabled: boolean };
      if (method === 'bancard' && !body.enabled) {
        return HttpResponse.json(
          { type: 'about:blank', title: 'Conflict', status: 409, detail: 'payment_method.last_enabled' },
          { status: 409, headers: { 'Content-Type': 'application/problem+json' } }
        );
      }
      return HttpResponse.json({ method, enabled: body.enabled });
    })
  );
}

describe('PaymentMethodsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders each payment method with its toggle state', async () => {
    setupHandlers();
    render(<PaymentMethodsPage />);

    expect(await screen.findByText('Bancard')).toBeInTheDocument();
    expect(screen.getByText('Bank transfer')).toBeInTheDocument();
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(2);
  });

  it('surfaces the last-enabled-method 409 as a readable message', async () => {
    const user = userEvent.setup();
    setupHandlers();
    render(<PaymentMethodsPage />);

    const bancardSwitch = await screen.findByRole('switch', { name: /disable bancard/i });
    await user.click(bancardSwitch);

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('At least one payment method must stay enabled.');
    });
  });
});
