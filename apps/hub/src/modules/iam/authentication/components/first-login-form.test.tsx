import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { FirstLoginForm } from './first-login-form';

import { applyScenario } from '@/lib/mocks/seed';
import { setSessionState } from '@/modules/iam/identity/session/store';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

function renderForm(initialEmail?: string  ) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const props = initialEmail !== undefined ? { initialEmail } : {};
  return render(
    <QueryClientProvider client={client}>
      <FirstLoginForm {...props} />
    </QueryClientProvider>
  );
}

describe('FirstLoginForm', () => {
  beforeEach(() => {
    applyScenario('happy');
    setSessionState({ status: 'unauthenticated', session: null });
    vi.clearAllMocks();
  });

  it('renders email step initially', () => {
    renderForm();
    expect(screen.getByLabelText(/Correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continuar/i })).toBeInTheDocument();
  });

  it('pre-fills email when initialEmail is provided', () => {
    renderForm('test@corehub.com');
    expect(screen.getByLabelText(/Correo electrónico/i)).toHaveValue('test@corehub.com');
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Correo electrónico/i), 'not-valid');
    await user.click(screen.getByRole('button', { name: /Continuar/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('transitions to OTP step after email submit', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Correo electrónico/i), 'test@corehub.com');
    await user.click(screen.getByRole('button', { name: /Continuar/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Código de verificación de 6 dígitos/i)).toBeInTheDocument();
    });
  });

  it('can navigate back from OTP to email', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Correo electrónico/i), 'test@corehub.com');
    await user.click(screen.getByRole('button', { name: /Continuar/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Volver/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Volver/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Correo electrónico/i)).toBeInTheDocument();
    });
  });
});
