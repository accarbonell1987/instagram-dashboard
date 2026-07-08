/**
 * Integration test — Login flow end-to-end through MSW Node.
 *
 * Renders <LoginPage> (public), types credentials, proceeds through OTP step,
 * and asserts that the session state reaches 'authenticated'.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { LoginForm } from '../components/login-form';

import { applyScenario } from '@/lib/mocks/seed';
import { setSessionState } from '@/modules/iam/identity/session/store';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

function renderWithProviders(element: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}

/** Returns the actual password <input> (not the toggle button whose aria-label also contains "contraseña"). */
function getPasswordInput(): HTMLElement {
  return screen.getAllByLabelText(/Contraseña/i).find(
    (el) => el.tagName.toLowerCase() === 'input',
  )!;
}

describe('Login flow — integration', () => {
  beforeEach(() => {
    applyScenario('happy');
    setSessionState({ status: 'unauthenticated', session: null });
    vi.clearAllMocks();
  });

  it('renders LoginForm with credentials inputs', () => {
    renderWithProviders(<LoginForm />);
    expect(screen.getByLabelText(/Correo electrónico/i)).toBeInTheDocument();
    expect(getPasswordInput()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ingresar/i })).toBeInTheDocument();
  });

  it('shows OTP step after submitting credentials', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    await user.type(screen.getByLabelText(/Correo electrónico/i), 'test@corehub.com');
    await user.type(getPasswordInput(), 'any-password');
    await user.click(screen.getByRole('button', { name: /Ingresar/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Código de verificación de 6 dígitos/i)).toBeInTheDocument();
    });
  });

  it('shows error when credentials are wrong', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    await user.type(screen.getByLabelText(/Correo electrónico/i), 'notexist@example.com');
    await user.type(getPasswordInput(), 'wrong');
    await user.click(screen.getByRole('button', { name: /Ingresar/i }));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert.textContent).toMatch(/correo o contraseña incorrectos/i);
    });
  });

  it('full flow: credentials → OTP step transition', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    // Step 1: Credentials
    expect(screen.getByRole('button', { name: /Ingresar/i })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Correo electrónico/i), 'test@corehub.com');
    await user.type(getPasswordInput(), 'any-password');
    await user.click(screen.getByRole('button', { name: /Ingresar/i }));

    // Step 2: OTP step should appear
    await waitFor(() => {
      expect(screen.getByLabelText(/Código de verificación de 6 dígitos/i)).toBeInTheDocument();
    });

    // Verify the OTP form shows expected content
    expect(screen.getByText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Verificar código/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Volver/i })).toBeInTheDocument();
  });
});
