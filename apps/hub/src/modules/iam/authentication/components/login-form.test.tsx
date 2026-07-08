import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { LoginForm } from './login-form';

import { server } from '@/lib/mocks/server';
import { applyScenario } from '@/lib/mocks/seed';
import { mintFakeJwt } from '@/lib/mocks/seed-utils';
import { setSessionState } from '@/modules/iam/identity/session/store';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

function renderLoginForm() {
  return render(<LoginForm />);
}

/** Returns the actual password <input> (not the toggle button whose aria-label also contains "contraseña"). */
function getPasswordInput(): HTMLElement {
  // getAllByLabelText returns multiple elements because the PasswordInput toggle button
  // also has aria-label="Mostrar contraseña". We want only the real <input>.
  return screen.getAllByLabelText(/Contraseña/i).find(
    (el) => el.tagName.toLowerCase() === 'input',
  )!;
}

describe('LoginForm — credentials step', () => {
  beforeEach(() => {
    applyScenario('happy');
    setSessionState({ status: 'unauthenticated', session: null });
    vi.clearAllMocks();
  });

  it('renders email and password inputs', () => {
    renderLoginForm();
    expect(screen.getByLabelText(/Correo electrónico/i)).toBeInTheDocument();
    expect(getPasswordInput()).toBeInTheDocument();
  });

  it('shows validation error for invalid email', async () => {
    const user = userEvent.setup();
    renderLoginForm();

    await user.type(screen.getByLabelText(/Correo electrónico/i), 'not-an-email');
    await user.tab();
    await user.click(screen.getByRole('button', { name: /Ingresar/i }));

    await waitFor(() => {
      expect(screen.getByText(/correo electrónico válido/i)).toBeInTheDocument();
    });
  });

  it('shows validation error when password is empty', async () => {
    const user = userEvent.setup();
    renderLoginForm();

    await user.type(screen.getByLabelText(/Correo electrónico/i), 'test@corehub.com');
    await user.click(screen.getByRole('button', { name: /Ingresar/i }));

    await waitFor(() => {
      expect(screen.getByText(/contraseña es requerida/i)).toBeInTheDocument();
    });
  });

  it('transitions to OTP step on successful login', async () => {
    const user = userEvent.setup();
    renderLoginForm();

    await user.type(screen.getByLabelText(/Correo electrónico/i), 'test@corehub.com');
    await user.type(getPasswordInput(), 'any-password');
    await user.click(screen.getByRole('button', { name: /Ingresar/i }));

    await waitFor(() => {
      expect(screen.getByText(/Enviamos un código/i)).toBeInTheDocument();
    });
    // OTP step now visible
    expect(screen.getByLabelText(/Código de verificación de 6 dígitos/i)).toBeInTheDocument();
  });

  it('shows inline error for wrong credentials', async () => {
    const user = userEvent.setup();
    renderLoginForm();

    await user.type(screen.getByLabelText(/Correo electrónico/i), 'notexist@example.com');
    await user.type(getPasswordInput(), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /Ingresar/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});

describe('LoginForm — OTP step', () => {
  beforeEach(() => {
    applyScenario('happy');
    setSessionState({ status: 'unauthenticated', session: null });
    vi.clearAllMocks();
  });

  it('renders OTP step after successful login', async () => {
    const user = userEvent.setup();
    renderLoginForm();

    await user.type(screen.getByLabelText(/Correo electrónico/i), 'test@corehub.com');
    await user.type(getPasswordInput(), 'any-password');
    await user.click(screen.getByRole('button', { name: /Ingresar/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Código de verificación de 6 dígitos/i)).toBeInTheDocument();
    });
  });

  it('can navigate back to credentials step', async () => {
    const user = userEvent.setup();
    renderLoginForm();

    // Get to OTP step
    await user.type(screen.getByLabelText(/Correo electrónico/i), 'test@corehub.com');
    await user.type(getPasswordInput(), 'any-password');
    await user.click(screen.getByRole('button', { name: /Ingresar/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Volver/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Volver/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Correo electrónico/i)).toBeInTheDocument();
    });
  });
});

describe('LoginForm — device trust y errores de cuenta', () => {
  const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

  beforeEach(() => {
    applyScenario('happy');
    setSessionState({ status: 'unauthenticated', session: null });
    vi.clearAllMocks();
  });

  it('redirige a "/" directamente sin mostrar OTP cuando otpRequired es false (trusted device)', async () => {
    const fakeSession = {
      accessToken: mintFakeJwt({
        sub: 'user-0001',
        email: 'test@corehub.com',
        name: 'Ana Pereira',
        tenant_id: 'acme',
        role: 'TenantAdmin',
      }),
      expiresIn: 900,
      tokenType: 'Bearer',
      user: {
        id: 'user-0001',
        email: 'test@corehub.com',
        fullName: 'Ana Pereira',
        picture: null,
        role: 'TenantAdmin',
      },
      tenant: { id: 'tenant-001', slug: 'acme', name: 'Empresa Acme S.A.', planId: 'professional', status: 'active' },
      role: 'TenantAdmin',
    };

    server.use(
      http.post(`${BASE}/auth/login`, () =>
        HttpResponse.json({ otpRequired: false, session: fakeSession })
      )
    );

    const user = userEvent.setup();
    renderLoginForm();

    await user.type(screen.getByLabelText(/Correo electrónico/i), 'test@corehub.com');
    await user.type(getPasswordInput(), 'any-password');
    await user.click(screen.getByRole('button', { name: /Ingresar/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });

    // El step de OTP no debe aparecer
    expect(screen.queryByLabelText(/Código de verificación de 6 dígitos/i)).not.toBeInTheDocument();
  });

  it('muestra mensaje de cuenta suspendida cuando login responde con 403 (ForbiddenError)', async () => {
    server.use(
      http.post(`${BASE}/auth/login`, () =>
        HttpResponse.json(
          { type: 'https://corehub.com/errors/forbidden', title: 'Forbidden', status: 403, code: 'account.suspended' },
          { status: 403, headers: { 'Content-Type': 'application/problem+json' } }
        )
      )
    );

    const user = userEvent.setup();
    renderLoginForm();

    await user.type(screen.getByLabelText(/Correo electrónico/i), 'test@corehub.com');
    await user.type(getPasswordInput(), 'any-password');
    await user.click(screen.getByRole('button', { name: /Ingresar/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(/suspendida/i);
      expect(screen.getByRole('alert')).toHaveTextContent(/soporte/i);
    });

    // El step de OTP no debe aparecer
    expect(screen.queryByLabelText(/Código de verificación de 6 dígitos/i)).not.toBeInTheDocument();
  });
});

describe('LoginForm — defensivos y edge cases', () => {
  const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

  beforeEach(() => {
    applyScenario('happy');
    setSessionState({ status: 'unauthenticated', session: null });
    vi.clearAllMocks();
  });

  it('muestra mensaje genérico ante error de red (fetch rechaza)', async () => {
    server.use(
      http.post(`${BASE}/auth/login`, () => HttpResponse.error())
    );

    const user = userEvent.setup();
    renderLoginForm();

    await user.type(screen.getByLabelText(/Correo electrónico/i), 'test@corehub.com');
    await user.type(getPasswordInput(), 'any-password');
    await user.click(screen.getByRole('button', { name: /Ingresar/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/error inesperado/i);
    });

    // El step de OTP no debe aparecer
    expect(screen.queryByLabelText(/Código de verificación de 6 dígitos/i)).not.toBeInTheDocument();
  });

  it('el botón de submit se deshabilita durante la llamada API', async () => {
    // Hacemos que el handler tarde para verificar el estado disabled
    server.use(
      http.post(`${BASE}/auth/login`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return HttpResponse.json({
          otpRequired: true,
          otpId: 'otp-123',
          channel: 'email',
          session: null,
        });
      })
    );

    const user = userEvent.setup();
    renderLoginForm();

    await user.type(screen.getByLabelText(/Correo electrónico/i), 'test@corehub.com');
    await user.type(getPasswordInput(), 'any-password');

    const submitButton = screen.getByRole('button', { name: /Ingresar/i });
    expect(submitButton).not.toBeDisabled();

    await user.click(submitButton);

    // Inmediatamente después del click, debe estar deshabilitado
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent(/Ingresando/i);

    // Al terminar la llamada, debe transicionar a OTP
    await waitFor(() => {
      expect(screen.getByLabelText(/Código de verificación de 6 dígitos/i)).toBeInTheDocument();
    });
  });
});
