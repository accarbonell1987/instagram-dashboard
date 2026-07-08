import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { seedDb } from '@/lib/mocks/seed';
import { server } from '@/lib/mocks/server';
import { http, HttpResponse } from 'msw';

import { PaymentMethodSection } from './payment-method-section';

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

describe('PaymentMethodSection', () => {
  describe('initial load', () => {
    it('renders loading state on mount before fetch resolves', () => {
      seedDb('happy');
      render(<PaymentMethodSection />);
      // aria-busy is present while loading
      expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    });

    it('renders PaymentMethodCard with data after successful fetch', async () => {
      seedDb('happy');
      render(<PaymentMethodSection />);
      await waitFor(() => {
        expect(screen.getByText(/4242/)).toBeInTheDocument();
      });
    });

    it('renders load error message when fetch fails', async () => {
      server.use(
        http.get(`${BASE}/billing/payment-method`, () =>
          HttpResponse.json({ type: 'about:blank', title: 'Error', status: 500 }, { status: 500 })
        )
      );
      render(<PaymentMethodSection />);
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });

    it('renders change-request button after successful load (even when paymentMethod is null)', async () => {
      seedDb('billing-empty');
      render(<PaymentMethodSection />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Solicitar/i })).toBeInTheDocument();
      });
    });

    it('does not render change-request button when load error is active', async () => {
      server.use(
        http.get(`${BASE}/billing/payment-method`, () =>
          HttpResponse.json({ type: 'about:blank', title: 'Error', status: 500 }, { status: 500 })
        )
      );
      render(<PaymentMethodSection />);
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('change request flow', () => {
    it('shows loading button state while request is in flight', async () => {
      seedDb('happy');
      render(<PaymentMethodSection />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Solicitar cambio/i })).toBeInTheDocument();
      });

      // Intercept to delay response
      server.use(
        http.post(`${BASE}/billing/payment-method`, async () => {
          await new Promise(() => {}); // never resolves
        })
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Solicitar cambio/i }));

      await waitFor(() => {
        expect(screen.getByText('Enviando…')).toBeInTheDocument();
      });
    });

    it('replaces button with success message on 202 response', async () => {
      seedDb('happy');
      render(<PaymentMethodSection />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Solicitar cambio/i })).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Solicitar cambio/i }));

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.getByText(/Solicitud recibida/i)).toBeInTheDocument();
      });
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('success message has role="status" and aria-live="polite"', async () => {
      seedDb('happy');
      render(<PaymentMethodSection />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Solicitar cambio/i })).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Solicitar cambio/i }));

      await waitFor(() => {
        const status = screen.getByRole('status');
        expect(status).toBeInTheDocument();
        expect(status).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('shows error message and re-enables button on generic error', async () => {
      seedDb('happy');
      server.use(
        http.post(`${BASE}/billing/payment-method`, () =>
          HttpResponse.json({ type: 'about:blank', title: 'Error', status: 500 }, { status: 500 })
        )
      );
      render(<PaymentMethodSection />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Solicitar cambio/i })).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Solicitar cambio/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/Error al enviar la solicitud/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Solicitar cambio/i })).not.toBeDisabled();
      });
    });

    it('shows "Ya existe una solicitud pendiente." on ConflictError (409)', async () => {
      seedDb('happy');
      // First request to create pending record
      server.use(
        http.post(`${BASE}/billing/payment-method`, () =>
          HttpResponse.json(
            { type: 'about:blank', title: 'Conflict', status: 409, detail: 'payment_method_change.pending_exists' },
            { status: 409, headers: { 'Content-Type': 'application/problem+json' } }
          )
        )
      );
      render(<PaymentMethodSection />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Solicitar cambio/i })).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Solicitar cambio/i }));

      await waitFor(() => {
        expect(screen.getByText('Ya existe una solicitud pendiente.')).toBeInTheDocument();
      });
    });

    it('does NOT auto-reset success state — message persists', async () => {
      seedDb('happy');
      render(<PaymentMethodSection />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Solicitar cambio/i })).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Solicitar cambio/i }));

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });

      // After some time, message should still be there
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });
});
