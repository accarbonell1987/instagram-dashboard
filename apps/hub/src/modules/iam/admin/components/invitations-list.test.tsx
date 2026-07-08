import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { InvitationsList } from './invitations-list';

import type { components } from '@/lib/api/types';

type InvitationListItem = components['schemas']['InvitationListItem'];

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
const PAST_DATE = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();

const mockInvitations: InvitationListItem[] = [
  {
    id: 'inv-pending-001',
    email: 'pending1@corehub.com',
    role: 'User',
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: FUTURE_DATE,
  },
  {
    id: 'inv-pending-002',
    email: 'pending2@corehub.com',
    role: 'TenantAdmin',
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: FUTURE_DATE,
  },
  {
    id: 'inv-accepted-001',
    email: 'accepted@corehub.com',
    role: 'User',
    status: 'accepted',
    createdAt: new Date().toISOString(),
    expiresAt: FUTURE_DATE,
    usedAt: PAST_DATE,
  },
];

describe('InvitationsList', () => {
  const mockOnRevoke = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders list of invitations with data', () => {
    render(
      <InvitationsList invitations={mockInvitations} onRevoke={mockOnRevoke} />
    );

    expect(screen.getByText('pending1@corehub.com')).toBeInTheDocument();
    expect(screen.getByText('pending2@corehub.com')).toBeInTheDocument();
    expect(screen.getByText('accepted@corehub.com')).toBeInTheDocument();
  });

  it('renders correct status badge for each status', () => {
    render(
      <InvitationsList invitations={mockInvitations} onRevoke={mockOnRevoke} />
    );

    const pendingBadges = screen.getAllByText('Pendiente');
    expect(pendingBadges).toHaveLength(2);
    expect(screen.getByText('Aceptada')).toBeInTheDocument();
  });

  it('shows Revocar button only for pending invitations', () => {
    render(
      <InvitationsList invitations={mockInvitations} onRevoke={mockOnRevoke} />
    );

    const revokeButtons = screen.getAllByRole('button', { name: /Revocar/i });
    expect(revokeButtons).toHaveLength(2); // only pending ones
  });

  it('calls onRevoke with id and email when Revocar is clicked', async () => {
    const user = userEvent.setup();
    render(
      <InvitationsList invitations={mockInvitations} onRevoke={mockOnRevoke} />
    );

    const revokeButtons = screen.getAllByRole('button', { name: /Revocar/i });
    await user.click(revokeButtons[0]!);

    expect(mockOnRevoke).toHaveBeenCalledWith('inv-pending-001', 'pending1@corehub.com');
  });

  it('shows empty message when no invitations', () => {
    render(<InvitationsList invitations={[]} onRevoke={mockOnRevoke} />);

    expect(screen.getByText(/No hay invitaciones/i)).toBeInTheDocument();
  });

  it('shows skeleton while loading', () => {
    render(<InvitationsList invitations={[]} onRevoke={mockOnRevoke} isLoading={true} />);

    // Skeletons are aria-hidden — check they don't show data
    expect(screen.queryByText(/No hay invitaciones/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
