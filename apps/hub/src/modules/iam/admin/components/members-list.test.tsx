import { TooltipProvider } from '@core/ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    productRoles: [
      { id: 'role-1', productId: 'instagram-dashboard', key: 'analyst', name: 'Analista' },
    ],
  },
  // No fullName at all — the contract types it optional, not nullable.
  {
    id: 'user-2',
    email: 'beto@empresa.com',
    role: 'User',
    status: 'suspended',
    createdAt: '2026-07-02T00:00:00.000Z',
    productRoles: [],
  },
];

function renderList(props: Partial<Parameters<typeof MembersList>[0]> = {}) {
  return render(
    <TooltipProvider>
      <MembersList
        members={MEMBERS}
        currentUserId="user-1"
        onSuspend={vi.fn()}
        onActivate={vi.fn()}
        onDelete={vi.fn()}
        onEditAccess={vi.fn()}
        {...props}
      />
    </TooltipProvider>
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

  it('names the product roles a member holds', () => {
    renderList();
    expect(screen.getByText('Analista')).toBeInTheDocument();
  });

  /**
   * No product role does not mean no access — the resolver only starts
   * narrowing once a role exists. Reading "Sin accesos" here would send an
   * admin hunting for a permission the member already has.
   */
  it('says a member without roles still sees the whole plan', () => {
    renderList();
    expect(screen.getByText('Todo el plan')).toBeInTheDocument();
  });

  /**
   * The actions menu hides itself for the current user, so access editing lives
   * outside it: a tenant whose admin is its only member must still be able to
   * set their own.
   */
  it('offers access editing for the current user too', async () => {
    const user = userEvent.setup();
    const onEditAccess = vi.fn();
    renderList({ onEditAccess });

    expect(screen.queryByRole('button', { name: 'Acciones para ana@empresa.com' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Editar accesos de ana@empresa.com' }));

    expect(onEditAccess).toHaveBeenCalledWith('user-1');
  });
});
