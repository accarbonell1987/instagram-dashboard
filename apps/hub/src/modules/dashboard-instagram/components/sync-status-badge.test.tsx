import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SyncStatusBadge } from './sync-status-badge';
import type { SyncState } from '../types/instagram.types';

const idleState: SyncState = {
  status: 'idle',
  lastSyncAt: '2026-06-10T10:00:00Z',
  mediaCount: 42,
  nextSyncAvailableAt: null,
};

const syncingState: SyncState = {
  status: 'syncing',
  lastSyncAt: '2026-06-10T09:00:00Z',
  mediaCount: 42,
  nextSyncAvailableAt: null,
};

const errorState: SyncState = {
  status: 'error',
  lastSyncAt: null,
  mediaCount: 0,
  nextSyncAvailableAt: null,
};

const pausedState: SyncState = {
  status: 'paused',
  lastSyncAt: '2026-06-10T08:00:00Z',
  mediaCount: 30,
  nextSyncAvailableAt: '2026-06-10T12:00:00Z',
};

describe('SyncStatusBadge', () => {
  it('returns null when syncState is null', () => {
    const { container } = render(
      <SyncStatusBadge
        syncState={null}
        onTriggerSync={vi.fn()}
        isTriggering={false}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders "Actualizado" for idle status', () => {
    render(
      <SyncStatusBadge
        syncState={idleState}
        onTriggerSync={vi.fn()}
        isTriggering={false}
      />,
    );
    expect(screen.getByText('Actualizado')).toBeInTheDocument();
  });

  it('renders "Sincronizando..." for syncing status', () => {
    render(
      <SyncStatusBadge
        syncState={syncingState}
        onTriggerSync={vi.fn()}
        isTriggering={false}
      />,
    );
    expect(screen.getByText('Sincronizando...')).toBeInTheDocument();
  });

  it('renders "Error de sincronización" for error status', () => {
    render(
      <SyncStatusBadge
        syncState={errorState}
        onTriggerSync={vi.fn()}
        isTriggering={false}
      />,
    );
    expect(screen.getByText('Error de sincronización')).toBeInTheDocument();
  });

  it('renders "En pausa" for paused status', () => {
    render(
      <SyncStatusBadge
        syncState={pausedState}
        onTriggerSync={vi.fn()}
        isTriggering={false}
      />,
    );
    expect(screen.getByText('En pausa')).toBeInTheDocument();
  });

  it('calls onTriggerSync when sync button clicked', async () => {
    const onTriggerSync = vi.fn().mockResolvedValue(undefined);
    render(
      <SyncStatusBadge
        syncState={idleState}
        onTriggerSync={onTriggerSync}
        isTriggering={false}
      />,
    );
    const button = screen.getByLabelText('Sincronizar ahora');
    await userEvent.click(button);
    expect(onTriggerSync).toHaveBeenCalledTimes(1);
  });

  it('disables sync button while syncing', () => {
    render(
      <SyncStatusBadge
        syncState={syncingState}
        onTriggerSync={vi.fn()}
        isTriggering={false}
      />,
    );
    expect(screen.getByLabelText('Sincronizar ahora')).toBeDisabled();
  });

  it('disables sync button while triggering', () => {
    render(
      <SyncStatusBadge
        syncState={idleState}
        onTriggerSync={vi.fn()}
        isTriggering={true}
      />,
    );
    expect(screen.getByLabelText('Sincronizar ahora')).toBeDisabled();
  });
});
