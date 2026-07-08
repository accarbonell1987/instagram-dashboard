import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { InviteForm } from './invite-form';

import { server } from '@/lib/mocks/server';
import { applyScenario } from '@/lib/mocks/seed';

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

describe('InviteForm', () => {
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    applyScenario('happy');
    vi.clearAllMocks();
  });

  it('renders email and role inputs', () => {
    render(<InviteForm onSuccess={mockOnSuccess} />);

    expect(screen.getByLabelText(/Correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Rol/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Invitar/i })).toBeInTheDocument();
  });

  it('shows validation error when email is invalid on submit', async () => {
    const user = userEvent.setup();
    render(<InviteForm onSuccess={mockOnSuccess} />);

    await user.type(screen.getByLabelText(/Correo electrónico/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /Invitar/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(/Email inválido/i);
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it('calls onSuccess on successful submit', async () => {
    const user = userEvent.setup();
    render(<InviteForm onSuccess={mockOnSuccess} />);

    await user.type(screen.getByLabelText(/Correo electrónico/i), 'nuevo@empresa.com');
    await user.click(screen.getByRole('button', { name: /Invitar/i }));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledOnce();
    });
  });

  it('shows inline error for 409 pending_exists', async () => {
    server.use(
      http.post(`${BASE}/invitations`, () =>
        HttpResponse.json(
          {
            type: 'https://corehub.com/errors/conflict',
            title: 'Conflict',
            status: 409,
            detail: 'invitation.pending_exists',
          },
          { status: 409, headers: { 'Content-Type': 'application/problem+json' } }
        )
      )
    );

    const user = userEvent.setup();
    render(<InviteForm onSuccess={mockOnSuccess} />);

    await user.type(screen.getByLabelText(/Correo electrónico/i), 'pending1@corehub.com');
    await user.click(screen.getByRole('button', { name: /Invitar/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(
        /Ya existe una invitación pendiente para este email/i
      );
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it('shows inline error for 409 active_user_exists', async () => {
    server.use(
      http.post(`${BASE}/invitations`, () =>
        HttpResponse.json(
          {
            type: 'https://corehub.com/errors/conflict',
            title: 'Conflict',
            status: 409,
            detail: 'invitation.active_user_exists',
          },
          { status: 409, headers: { 'Content-Type': 'application/problem+json' } }
        )
      )
    );

    const user = userEvent.setup();
    render(<InviteForm onSuccess={mockOnSuccess} />);

    await user.type(screen.getByLabelText(/Correo electrónico/i), 'active@corehub.com');
    await user.click(screen.getByRole('button', { name: /Invitar/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(
        /Este email ya tiene una cuenta activa en el tenant/i
      );
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
  });
});
