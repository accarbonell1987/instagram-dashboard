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

const account = {
  bankName: 'Banco Itaú',
  accountType: 'checking',
  accountNumber: '123',
  accountHolder: 'Acme S.A.',
};

function setupHandlers(items: Record<string, unknown>[] = [
  { method: 'bancard', enabled: true, displayName: 'Bancard', accounts: [] },
  { method: 'bank_transfer', enabled: false, displayName: 'Bank transfer', accounts: [] },
]) {
  server.use(
    http.get(`${BASE}/admin/payment-methods`, () => {
      return HttpResponse.json({ items });
    }),
    http.patch(`${BASE}/admin/payment-methods/:method`, async ({ params, request }) => {
      const method = params['method'] as string;
      const body = (await request.json()) as {
        enabled: boolean;
        displayName?: string;
        accounts?: unknown[];
      };
      const current = items.find((i) => i['method'] === method);

      if (method === 'bancard' && !body.enabled) {
        return HttpResponse.json(
          { type: 'about:blank', title: 'Conflict', status: 409, detail: 'payment_method.last_enabled' },
          { status: 409, headers: { 'Content-Type': 'application/problem+json' } }
        );
      }
      const nextAccounts = body.accounts ?? current?.['accounts'] ?? [];
      if (method === 'bank_transfer' && body.enabled && (nextAccounts as unknown[]).length === 0) {
        return HttpResponse.json(
          { type: 'about:blank', title: 'Conflict', status: 409, detail: 'payment_method.no_accounts_configured' },
          { status: 409, headers: { 'Content-Type': 'application/problem+json' } }
        );
      }
      return HttpResponse.json({
        method,
        enabled: body.enabled,
        displayName: body.displayName ?? current?.['displayName'],
        accounts: nextAccounts,
      });
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

    const bancardSwitch = await screen.findByRole('switch', { name: /deshabilitar bancard/i });
    await user.click(bancardSwitch);

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Al menos un método de pago debe permanecer habilitado.');
    });
  });

  it('refuses enabling bank transfer with no accounts configured', async () => {
    const user = userEvent.setup();
    setupHandlers();
    render(<PaymentMethodsPage />);

    const bankTransferSwitch = await screen.findByRole('switch', { name: /habilitar transferencia bancaria/i });
    await user.click(bankTransferSwitch);

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        'Agregá al menos una cuenta bancaria antes de habilitar la transferencia bancaria.'
      );
    });
  });

  it('adds a bank account and saves it through the edit dialog', async () => {
    const user = userEvent.setup();
    setupHandlers();
    render(<PaymentMethodsPage />);

    const editButtons = await screen.findAllByRole('button', { name: 'Editar' });
    await user.click(editButtons[1]!); // bank_transfer row

    await user.click(screen.getByRole('button', { name: 'Agregar cuenta' }));
    await user.type(screen.getByLabelText(/nombre del banco/i), account.bankName);
    await user.type(screen.getByLabelText(/número de cuenta/i), account.accountNumber);
    await user.type(screen.getByLabelText(/titular de la cuenta/i), account.accountHolder);

    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    // The saved account is rendered as a card rather than counted in a sentence,
    // so assert the operator can actually read it back: bank, holder and type.
    await waitFor(() => {
      expect(screen.getByText(account.bankName)).toBeInTheDocument();
    });
    expect(screen.getByText(account.accountHolder)).toBeInTheDocument();
    expect(screen.getByText('Cuenta corriente')).toBeInTheDocument();
  });

  it('requires a display name in the edit dialog', async () => {
    const user = userEvent.setup();
    setupHandlers();
    render(<PaymentMethodsPage />);

    const editButtons = await screen.findAllByRole('button', { name: 'Editar' });
    await user.click(editButtons[0]!); // bancard row

    const displayNameInput = screen.getByLabelText('Nombre visible');
    await user.clear(displayNameInput);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('El nombre visible es obligatorio')).toBeInTheDocument();
  });
});
