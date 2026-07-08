import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import * as invitationService from '../services/invitation.service';

import { AcceptInvitationForm } from './accept-invitation-form';


import type { Session } from '@/modules/iam/identity/session/store';

// Mock next/navigation
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

// Mock the invitation service
vi.mock('../services/invitation.service.js', () => ({
  acceptInvitation: vi.fn(),
  updateProfile: vi.fn(),
}));

// Mock CompleteProfileStep to simplify testing
vi.mock('./complete-profile-step.js', () => ({
  CompleteProfileStep: ({ onSuccess, onSkip }: { onSuccess: () => void; onSkip: () => void }) => (
    <div data-testid="complete-profile-step">
      <button type="button" onClick={onSuccess}>complete-success</button>
      <button type="button" onClick={onSkip}>complete-skip</button>
    </div>
  ),
}));

// Mock SetPasswordForm to simplify testing
vi.mock('@/modules/iam/authentication/components/set-password-form.js', () => ({
  SetPasswordForm: ({ onSubmit, submitLabel }: { onSubmit: (p: string) => Promise<void>; submitLabel?: string }) => (
    <form
      data-testid="set-password-form"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit('NewP@ss1!');
      }}
    >
      <button type="submit">{submitLabel ?? 'Guardar contraseña'}</button>
    </form>
  ),
}));

const defaultProps = {
  token: 'test-token-abc',
  invitation: {
    email: 'usuario@empresa.com',
    tenantName: 'Empresa Test S.A.',
    inviterName: 'Carlos López',
    role: 'User' as const,
  },
};

describe('AcceptInvitationForm', () => {
  beforeEach(() => {
    pushMock.mockClear();
    vi.mocked(invitationService.acceptInvitation).mockClear();
  });

  it('renders preview with tenant name and role label', () => {
    render(<AcceptInvitationForm {...defaultProps} />);

    expect(screen.getByText(/Empresa Test S\.A\./)).toBeInTheDocument();
    expect(screen.getByText(/Usuario/)).toBeInTheDocument();
    expect(screen.getByText(/Carlos López/)).toBeInTheDocument();
    expect(screen.getByText(/usuario@empresa\.com/)).toBeInTheDocument();
  });

  it('advances to set-password step on "Aceptar invitación" click', async () => {
    render(<AcceptInvitationForm {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /Aceptar invitación/i }));

    await waitFor(() => {
      expect(screen.getByTestId('set-password-form')).toBeInTheDocument();
    });
  });

  it('shows complete-profile step after successful invitation acceptance', async () => {
    const mockSession: Session = {
      user: { id: '1', email: 'usuario@empresa.com', fullName: 'Usuario Test' },
      tenant: { id: 't1', slug: 'empresa-test' },
      role: 'User',
      accessToken: 'token',
      expiresAt: Date.now() + 900_000,
    };
    vi.mocked(invitationService.acceptInvitation).mockResolvedValue(mockSession);

    render(<AcceptInvitationForm {...defaultProps} />);

    // Advance to set-password step
    fireEvent.click(screen.getByRole('button', { name: /Aceptar invitación/i }));
    await waitFor(() => screen.getByTestId('set-password-form'));

    // Submit password form
    fireEvent.submit(screen.getByTestId('set-password-form'));

    // Now CompleteProfileStep should be shown
    await waitFor(() => {
      expect(screen.getByTestId('complete-profile-step')).toBeInTheDocument();
    });
  });

  it('calls router.push("/") when complete-profile onSuccess is triggered', async () => {
    const mockSession: Session = {
      user: { id: '1', email: 'usuario@empresa.com', fullName: 'Usuario Test' },
      tenant: { id: 't1', slug: 'empresa-test' },
      role: 'User',
      accessToken: 'token',
      expiresAt: Date.now() + 900_000,
    };
    vi.mocked(invitationService.acceptInvitation).mockResolvedValue(mockSession);

    render(<AcceptInvitationForm {...defaultProps} />);

    // Navigate to complete-profile step
    fireEvent.click(screen.getByRole('button', { name: /Aceptar invitación/i }));
    await waitFor(() => screen.getByTestId('set-password-form'));
    fireEvent.submit(screen.getByTestId('set-password-form'));
    await waitFor(() => screen.getByTestId('complete-profile-step'));

    // Trigger success on CompleteProfileStep
    fireEvent.click(screen.getByText('complete-success'));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/');
    });
  });

  it('shows an alert on acceptInvitation error', async () => {
    vi.mocked(invitationService.acceptInvitation).mockRejectedValue(
      new Error('Error al aceptar la invitación.')
    );

    render(<AcceptInvitationForm {...defaultProps} />);

    // Advance to set-password step
    fireEvent.click(screen.getByRole('button', { name: /Aceptar invitación/i }));
    await waitFor(() => screen.getByTestId('set-password-form'));

    // Submit password form
    fireEvent.submit(screen.getByTestId('set-password-form'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
