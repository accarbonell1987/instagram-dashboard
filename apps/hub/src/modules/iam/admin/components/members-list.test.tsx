import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { MembersList } from './members-list';

import type { components } from '@/lib/api/types';

type MemberListItem = components['schemas']['MemberListItem'];

const MEMBERS: MemberListItem[] = [
  {
    id: 'user-1',
    email: 'ana@empresa.com',
    fullName: 'Ana Pereira',
    role: 'TenantAdmin',
    status: 'active',
    createdAt: '2026-07-01T00:00:00.000Z',
  },
  // No fullName at all — the contract types it optional, not nullable.
  {
    id: 'user-2',
    email: 'beto@empresa.com',
    role: 'User',
    status: 'suspended',
    createdAt: '2026-07-02T00:00:00.000Z',
  },
];

function renderList(props: Partial<Parameters<typeof MembersList>[0]> = {}) {
  return render(
    <MembersList
      members={MEMBERS}
      currentUserId="user-1"
      onSuspend={vi.fn()}
      onActivate={vi.fn()}
      onDelete={vi.fn()}
      {...props}
    />
  );
}

describe('MembersList', () => {
  it('lists each member under the column headers', () => {
    renderList();
    expect(screen.getByRole('columnheader', { name: 'Nombre / Email' })).toBeInTheDocument();
    expect(screen.getByText('Ana Pereira')).toBeInTheDocument();
    expect(screen.getByText('ana@empresa.com')).toBeInTheDocument();
  });

  // A member who never set a name still has to be identifiable.
  it('falls back to the email when there is no full name', () => {
    renderList();
    expect(screen.getByText('beto@empresa.com')).toBeInTheDocument();
  });

  /**
   * This list sits inside a settings card, so it uses the bare frame: a
   * bordered panel here would draw a box inside the box already around it.
   */
  it('reports an empty team as plain text, not a boxed panel', () => {
    const { container } = renderList({ members: [] });
    expect(screen.getByText('No hay miembros').tagName).toBe('P');
    expect(container.querySelector('.rounded-lg')).toBeNull();
  });

  it('keeps the header in place while the skeletons show', () => {
    renderList({ isLoading: true });
    expect(screen.getByRole('columnheader', { name: 'Rol' })).toBeInTheDocument();
    expect(screen.queryByText('Ana Pereira')).toBeNull();
  });

  // Skeletons announce nothing on their own.
  it('marks the list busy while loading', () => {
    const { container } = renderList({ isLoading: true });
    const busy = container.querySelector('[aria-busy="true"]');
    expect(busy).not.toBeNull();
    expect(busy).toHaveAttribute('aria-label', 'Cargando miembros');
  });
});
