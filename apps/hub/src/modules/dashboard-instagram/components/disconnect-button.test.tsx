import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../services/instagram.service', () => ({
  disconnectAccount: vi.fn(),
}));

import { DisconnectButton } from './disconnect-button';
import { disconnectAccount } from '../services/instagram.service';

describe('DisconnectButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders disconnect button with accessible label', () => {
    render(<DisconnectButton onDisconnected={vi.fn()} />);
    expect(screen.getByLabelText('Desconectar cuenta')).toBeInTheDocument();
  });

  it('shows loading state on click (button disabled)', async () => {
    vi.mocked(disconnectAccount).mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();

    render(<DisconnectButton onDisconnected={vi.fn()} />);

    await user.click(screen.getByLabelText('Desconectar cuenta'));

    expect(screen.getByLabelText('Desconectar cuenta')).toBeDisabled();
  });

  it('calls onDisconnected callback after successful disconnect', async () => {
    vi.mocked(disconnectAccount).mockResolvedValue(undefined);
    const onDisconnected = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<DisconnectButton onDisconnected={onDisconnected} />);

    await user.click(screen.getByLabelText('Desconectar cuenta'));

    await waitFor(() => {
      expect(onDisconnected).toHaveBeenCalledTimes(1);
    });
  });

  it('shows error message on failure', async () => {
    vi.mocked(disconnectAccount).mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();

    render(<DisconnectButton onDisconnected={vi.fn()} />);

    await user.click(screen.getByLabelText('Desconectar cuenta'));

    await waitFor(() => {
      expect(
        screen.getByText('Error al desconectar. Intenta de nuevo.'),
      ).toBeInTheDocument();
    });
  });

  it('button is re-enabled after error', async () => {
    vi.mocked(disconnectAccount).mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();

    render(<DisconnectButton onDisconnected={vi.fn()} />);

    await user.click(screen.getByLabelText('Desconectar cuenta'));

    await waitFor(() => {
      expect(screen.getByLabelText('Desconectar cuenta')).not.toBeDisabled();
    });
  });
});
