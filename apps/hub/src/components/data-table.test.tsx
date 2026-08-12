import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { DataTable, TablePagination, Td, Th, Tr } from './data-table';

function renderTable(props: Partial<Parameters<typeof DataTable>[0]> = {}) {
  return render(
    <DataTable
      head={<Th>Nombre</Th>}
      isEmpty={false}
      {...props}
    >
      <Tr>
        <Td>Fila uno</Td>
      </Tr>
    </DataTable>
  );
}

describe('DataTable states', () => {
  it('renders the rows when there is nothing else to say', () => {
    renderTable();
    expect(screen.getByText('Fila uno')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Nombre' })).toBeInTheDocument();
  });

  it('shows the loading text instead of the table', () => {
    renderTable({ isLoading: true, loadingText: 'Cargando pagos...' });
    expect(screen.getByText('Cargando pagos...')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows the empty copy and its call to action', () => {
    renderTable({
      isEmpty: true,
      empty: { text: 'Todavía no hay planes.', action: <button type="button">Crear</button> },
    });
    expect(screen.getByText('Todavía no hay planes.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear' })).toBeInTheDocument();
  });

  it('reports an error as an alert', () => {
    renderTable({ error: 'No se pudo cargar' });
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar');
  });

  /**
   * A failed request also leaves the list empty. Announcing "no hay resultados"
   * for what is really a broken load sends the operator hunting for data that
   * never arrived, so the error has to win.
   */
  it('prefers the error over the empty state when a failed load left no rows', () => {
    renderTable({ error: 'No se pudo cargar', isEmpty: true, empty: { text: 'No hay nada' } });
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar');
    expect(screen.queryByText('No hay nada')).toBeNull();
  });

  it('prefers the error over the loading state', () => {
    renderTable({ error: 'No se pudo cargar', isLoading: true });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Cargando...')).toBeNull();
  });
});

describe('TablePagination', () => {
  it('renders nothing while everything fits on one page', () => {
    const { container } = render(
      <TablePagination page={1} pageSize={20} total={20} onPageChange={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('reports the current position', () => {
    render(<TablePagination page={2} pageSize={10} total={35} onPageChange={vi.fn()} />);
    expect(screen.getByText(/Página 2 de 4/)).toBeInTheDocument();
  });

  it('disables the ends so the page cannot leave its range', () => {
    const { rerender } = render(
      <TablePagination page={1} pageSize={10} total={30} onPageChange={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();

    rerender(<TablePagination page={3} pageSize={10} total={30} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  });

  it('moves one page at a time', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<TablePagination page={2} pageSize={10} total={30} onPageChange={onPageChange} />);

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    await user.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});
