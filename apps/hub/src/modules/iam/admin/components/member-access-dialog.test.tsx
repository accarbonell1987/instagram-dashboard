import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { MemberAccessDialog, MemberAccessForm } from './member-access-dialog';

import type { components } from '@/lib/api/types';
import type { TenantProductRoles } from '@/modules/iam/admin/services/member.service';

// jsdom's pointer-capture methods throw "not implemented" and scrollIntoView is
// absent; Radix's Select calls all of them while opening. Kept local rather
// than in vitest.setup.ts — it is Radix Select's requirement, not the suite's.
Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.releasePointerCapture = () => undefined;
Element.prototype.scrollIntoView = () => undefined;

type MemberListItem = components['schemas']['MemberListItem'];

const PRODUCTS: TenantProductRoles[] = [
  {
    productId: 'instagram-dashboard',
    productName: 'Instagram Dashboard',
    roles: [
      {
        id: 'role-analyst',
        productId: 'instagram-dashboard',
        key: 'analyst',
        name: 'Analista',
        moduleCount: 4,
      },
      {
        id: 'role-empty',
        productId: 'instagram-dashboard',
        key: 'empty',
        name: 'Sin módulos',
        moduleCount: 0,
      },
    ],
  },
];

const ANALYST = {
  id: 'role-analyst',
  productId: 'instagram-dashboard',
  key: 'analyst',
  name: 'Analista',
};

function member(overrides: Partial<MemberListItem> = {}): MemberListItem {
  return {
    id: 'user-1',
    email: 'ana@empresa.com',
    fullName: 'Ana Pereira',
    role: 'User',
    status: 'active',
    createdAt: '2026-07-01T00:00:00.000Z',
    productRoles: [],
    ...overrides,
  };
}

/**
 * The form is exercised outside its dialog on purpose: a Radix Select nested in
 * a Radix Dialog deadlocks in jsdom — the two focus scopes hand focus back and
 * forth forever, hanging the run with no timeout. The dialog shell is covered
 * separately, without opening a Select.
 */
function renderForm(props: Partial<Parameters<typeof MemberAccessForm>[0]> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  render(
    <MemberAccessForm
      member={member()}
      products={PRODUCTS}
      onSave={onSave}
      onCancel={onCancel}
      {...props}
    />
  );
  return { onSave, onCancel };
}

describe('MemberAccessForm', () => {
  it('offers one role picker per contracted product', () => {
    renderForm();
    expect(screen.getByLabelText('Instagram Dashboard')).toBeInTheDocument();
  });

  it('starts from the role the member already holds', () => {
    renderForm({ member: member({ productRoles: [ANALYST] }) });
    expect(screen.getByLabelText('Instagram Dashboard')).toHaveTextContent('Analista');
  });

  it('sends the chosen role when saving', async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm();

    await user.click(screen.getByLabelText('Instagram Dashboard'));
    await user.click(screen.getByRole('option', { name: 'Analista' }));
    await user.click(screen.getByRole('button', { name: 'Guardar accesos' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(['role-analyst']);
    });
  });

  /**
   * Clearing access is a real intent, and the endpoint takes the complete set —
   * so "no role" has to travel as an omission, not as a skipped save.
   */
  it('sends an empty set when access is cleared', async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm({ member: member({ productRoles: [ANALYST] }) });

    await user.click(screen.getByLabelText('Instagram Dashboard'));
    await user.click(screen.getByRole('option', { name: 'Sin rol asignado' }));
    await user.click(screen.getByRole('button', { name: 'Guardar accesos' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith([]);
    });
  });

  /**
   * The only way this screen can take a product away: the resolver intersects
   * the plan's modules with the role's, so a role that opens nothing leaves the
   * member with nothing. Warn before it is saved, not after.
   */
  it('warns that a role with no modules locks the member out', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText('Instagram Dashboard'));
    await user.click(screen.getByRole('option', { name: 'Sin módulos' }));

    expect(screen.getByText(/no habilita ningún módulo/)).toBeInTheDocument();
  });

  it('explains that no role means the whole plan', () => {
    renderForm();
    expect(screen.getByText(/ve todo lo que otorga el plan/)).toBeInTheDocument();
  });

  it('says so when the tenant has no products to hand out', () => {
    renderForm({ products: [] });
    expect(screen.getByText(/Todavía no hay productos contratados/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar accesos' })).toBeDisabled();
  });

  it('reports a failed save instead of closing silently', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error('boom'));
    renderForm({ member: member({ productRoles: [ANALYST] }), onSave });

    await user.click(screen.getByRole('button', { name: 'Guardar accesos' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/No pudimos guardar los accesos/);
  });
});

describe('MemberAccessDialog', () => {
  it('names the member whose access is being edited', () => {
    render(
      <MemberAccessDialog
        member={member()}
        products={PRODUCTS}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('dialog')).toHaveTextContent('ana@empresa.com');
  });

  it('stays shut with no member', () => {
    render(
      <MemberAccessDialog member={null} products={PRODUCTS} onSave={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  /**
   * Reopening on a different member must not carry the previous selection: the
   * form seeds its state from the member, and a stale selection is the one
   * thing that must never be saved onto the next person.
   */
  it('reseeds the form when it reopens on another member', () => {
    const { rerender } = render(
      <MemberAccessDialog
        member={member({ productRoles: [ANALYST] })}
        products={PRODUCTS}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Instagram Dashboard')).toHaveTextContent('Analista');

    rerender(
      <MemberAccessDialog
        member={member({ id: 'user-2', email: 'beto@empresa.com', productRoles: [] })}
        products={PRODUCTS}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Instagram Dashboard')).toHaveTextContent('Sin rol asignado');
  });
});
