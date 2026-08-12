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
