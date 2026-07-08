import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { RecoverForm } from './recover-form';

import { applyScenario } from '@/lib/mocks/seed';
import { server } from '@/lib/mocks/server';
import { setSessionState } from '@/modules/iam/identity/session/store';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

function renderForm(tenantSlug = 'acme') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RecoverForm tenantSlug={tenantSlug} />
    </QueryClientProvider>
  );
}

describe('RecoverForm', () => {
  beforeEach(() => {
    applyScenario('happy');
    setSessionState({ status: 'unauthenticated', session: null });
    vi.clearAllMocks();
  });

  it('renders email input', () => {
    renderForm();
    expect(screen.getByLabelText(/Correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar código/i })).toBeInTheDocument();
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Correo electrónico/i), 'invalid');
    await user.click(screen.getByRole('button', { name: /Enviar código/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('anti-enumeration: shows same success message regardless of email existence', async () => {
    const user = userEvent.setup();
    renderForm();

    // Try with non-existent email — backend returns 202 (anti-enum)
    await user.type(screen.getByLabelText(/Correo electrónico/i), 'notexist@example.com');
    await user.click(screen.getByRole('button', { name: /Enviar código/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(/recibirás un código/i);
    });
  });

  it('shows success message with known email', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Correo electrónico/i), 'test@corehub.com');
    await user.click(screen.getByRole('button', { name: /Enviar código/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  it('transitions to OTP step after email submit', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Correo electrónico/i), 'test@corehub.com');
    await user.click(screen.getByRole('button', { name: /Enviar código/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Código de verificación de 6 dígitos/i)).toBeInTheDocument();
    });
  });

  it('can navigate back from OTP to email', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Correo electrónico/i), 'test@corehub.com');
    await user.click(screen.getByRole('button', { name: /Enviar código/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Volver/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Volver/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Enviar código/i })).toBeInTheDocument();
    });
  });
});

describe('RecoverForm — rate limit', () => {
  beforeEach(() => {
    applyScenario('happy');
    setSessionState({ status: 'unauthenticated', session: null });
    vi.clearAllMocks();
  });

  it('muestra error de rate limit y NO avanza al step OTP cuando sendOtp retorna 429', async () => {
    const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

    server.use(
      http.post(`${BASE}/auth/otp/send`, () =>
        HttpResponse.json(
          { title: 'Too Many Requests', status: 429, detail: 'Rate limit exceeded' },
          { status: 429, headers: { 'Retry-After': '60' } }
        )
      )
    );

    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Correo electrónico/i), 'test@corehub.com');
    await user.click(screen.getByRole('button', { name: /Enviar código/i }));

    // Debe aparecer el error de rate limit con role="alert"
    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/intentos/i);
      expect(alert).toHaveTextContent(/minuto/i);
    });

    // NO debe haberse avanzado al step OTP
    expect(screen.queryByLabelText(/Código de verificación de 6 dígitos/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    // El formulario de email sigue visible
    expect(screen.getByLabelText(/Correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar código/i })).toBeInTheDocument();
  });
});
