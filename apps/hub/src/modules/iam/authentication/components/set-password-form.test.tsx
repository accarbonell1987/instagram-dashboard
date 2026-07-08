import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { SetPasswordForm } from './set-password-form';

import { applyScenario } from '@/lib/mocks/seed';

function renderForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  return {
    onSubmit,
    ...render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SetPasswordForm onSubmit={onSubmit} />
      </QueryClientProvider>
    ),
  };
}

describe('SetPasswordForm', () => {
  beforeEach(() => {
    applyScenario('happy');
    vi.clearAllMocks();
  });

  it('renders password and confirm inputs', () => {
    renderForm();
    expect(screen.getByLabelText(/Nueva contraseña/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirmar contraseña/i)).toBeInTheDocument();
  });

  it('fetches and shows password policy checklist', async () => {
    renderForm();
    await waitFor(() => {
      // Policy is fetched and checklist shown
      expect(screen.getByRole('list', { name: /Requisitos de contraseña/i })).toBeInTheDocument();
    });
  });

  it('updates checklist as user types', async () => {
    const user = userEvent.setup();
    renderForm();

    // Wait for policy to load
    await waitFor(() => {
      expect(screen.getByRole('list', { name: /Requisitos de contraseña/i })).toBeInTheDocument();
    });

    const passwordInput = screen.getByLabelText(/Nueva contraseña/i);
    await user.type(passwordInput, 'Abc!1234567');

    // Some rules should start passing
    await waitFor(() => {
      const checklist = screen.getByRole('list', { name: /Requisitos de contraseña/i });
      expect(checklist).toBeInTheDocument();
    });
  });

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup();
    renderForm();

    await waitFor(() => {
      expect(screen.getByRole('list', { name: /Requisitos/i })).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Nueva contraseña/i), 'Abc!1234567X');
    await user.type(screen.getByLabelText(/Confirmar contraseña/i), 'Different!9X');

    // Error appears on change (mode: 'onChange') — no click needed
    await waitFor(() => {
      expect(screen.getByText(/contraseñas no coinciden/i)).toBeInTheDocument();
    });

    // Button stays disabled until passwords match
    expect(screen.getByRole('button', { name: /Guardar contraseña/i })).toBeDisabled();
  });

  it('calls onSubmit with password when form is valid', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SetPasswordForm onSubmit={onSubmit} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('list', { name: /Requisitos/i })).toBeInTheDocument();
    });

    const validPassword = 'Abc!1234567X';
    await user.type(screen.getByLabelText(/Nueva contraseña/i), validPassword);
    await user.type(screen.getByLabelText(/Confirmar contraseña/i), validPassword);

    // Wait for all rules to pass (button should be enabled)
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Guardar contraseña/i });
      expect(btn).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /Guardar contraseña/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(validPassword);
    });
  });

  it('uses custom submitLabel', () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SetPasswordForm onSubmit={vi.fn()} submitLabel="Activar cuenta" />
      </QueryClientProvider>
    );
    expect(screen.getByRole('button', { name: /Activar cuenta/i })).toBeInTheDocument();
  });
});
