import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { ModuleTransfer, type ModuleItem } from './module-transfer';

/**
 * The drag overlay has to be portalled out of the component's own subtree.
 *
 * ModuleTransfer is rendered inside DialogContent, which centres itself with
 * `translate-x-[-50%] translate-y-[-50%]`. A transformed ancestor becomes the
 * containing block for its `position: fixed` descendants, so an overlay left
 * inside the dialog measures its viewport coordinates from the dialog's box and
 * lands offset by half the modal — visibly outside it, not under the cursor.
 *
 * These tests assert the structural property that prevents that: while a drag
 * is active, the overlay is a child of <body> and not of the dialog.
 */

const MODULES: ModuleItem[] = [
  { id: 'ig-basic-metrics', name: 'Métricas Básicas', parentId: null },
  { id: 'ig-publications', name: 'Publicaciones', parentId: null },
];

/** Minimal stand-in for the transformed DialogContent the component lives in. */
function TransformedDialog({ children }: { children: React.ReactNode }) {
  return (
    <div data-testid="dialog" style={{ position: 'fixed', transform: 'translate(-50%, -50%)' }}>
      {children}
    </div>
  );
}

async function dragOnto(handle: Element, target: Element): Promise<void> {
  const user = userEvent.setup();
  await user.pointer([
    { keys: '[MouseLeft>]', target: handle, coords: { x: 0, y: 0 } },
    { target, coords: { x: 10, y: 10 } },
    { keys: '[/MouseLeft]', target },
  ]);
}

async function startDragOn(handle: Element): Promise<void> {
  const user = userEvent.setup();
  // The sensor has a 5px activation constraint, so the press has to be
  // followed by a real move before @dnd-kit treats it as a drag.
  await user.pointer([
    { keys: '[MouseLeft>]', target: handle, coords: { x: 0, y: 0 } },
    { target: handle, coords: { x: 0, y: 60 } },
  ]);
}

describe('ModuleTransfer drag overlay', () => {
  it('renders the dragged card under <body>, outside the transformed dialog', async () => {
    render(
      <TransformedDialog>
        <ModuleTransfer
          available={MODULES}
          assigned={[]}
          onAssign={vi.fn()}
          onUnassign={vi.fn()}
        />
      </TransformedDialog>
    );

    // The listener lives on the grip button, not on the row that wraps it.
    await startDragOn(screen.getByRole('button', { name: 'Arrastrar Métricas Básicas' }));

    // Two nodes now carry the label: the source row and the overlay copy.
    await waitFor(() => {
      expect(screen.getAllByText('Métricas Básicas').length).toBeGreaterThan(1);
    });

    const dialog = screen.getByTestId('dialog');
    const overlayCopy = screen
      .getAllByText('Métricas Básicas')
      .find((node) => !dialog.contains(node));

    expect(
      overlayCopy,
      'the overlay copy must live outside the transformed dialog, or fixed positioning is measured from the dialog box'
    ).toBeDefined();
    expect(document.body.contains(overlayCopy as Node)).toBe(true);
  });
});

/**
 * The empty column has to accept the drop.
 *
 * SortableContext registers the rows inside a column, not the column itself, so
 * with nothing assigned yet there was no droppable to aim at: `over` came back
 * null and handleDragEnd bailed out before calling onAssign. Assigning the very
 * first module — the one case that matters on a fresh role — silently did
 * nothing.
 *
 * Only the unassign direction is asserted. The mirrored case is the same
 * invariant, but jsdom reports every rect as 0×0, so @dnd-kit's closestCenter
 * cannot tell the columns apart when the source column still has rows and
 * resolves the drop arbitrarily. Forcing it would mean stubbing geometry for
 * every node, and a test that elaborate is likelier to break on a dnd-kit
 * upgrade than to catch a real regression. This one already goes red when the
 * column stops being a droppable, which is the thing that broke.
 */
describe('ModuleTransfer drop targets', () => {
  it('unassigns a module dropped back on the empty available column', async () => {
    const onUnassign = vi.fn();
    render(
      <ModuleTransfer
        available={[]}
        assigned={MODULES}
        onAssign={vi.fn()}
        onUnassign={onUnassign}
      />
    );

    await dragOnto(
      screen.getByRole('button', { name: 'Arrastrar Publicaciones' }),
      screen.getByText('Todos asignados')
    );

    await waitFor(() => {
      expect(onUnassign).toHaveBeenCalledWith('ig-publications');
    });
  });
});
