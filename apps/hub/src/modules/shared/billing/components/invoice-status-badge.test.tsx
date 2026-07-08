import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { InvoiceStatusBadge } from './invoice-status-badge';

describe('InvoiceStatusBadge', () => {
  it('renders "Pagada" for status paid', () => {
    render(<InvoiceStatusBadge status="paid" />);
    expect(screen.getByText('Pagada')).toBeInTheDocument();
  });

  it('renders "Pendiente" for status pending', () => {
    render(<InvoiceStatusBadge status="pending" />);
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
  });

  it('renders "Vencida" for status overdue', () => {
    render(<InvoiceStatusBadge status="overdue" />);
    expect(screen.getByText('Vencida')).toBeInTheDocument();
  });

  it('renders "Cancelada" for status cancelled', () => {
    render(<InvoiceStatusBadge status="cancelled" />);
    expect(screen.getByText('Cancelada')).toBeInTheDocument();
  });

  it('has aria-label "Estado: Pagada" for paid status', () => {
    render(<InvoiceStatusBadge status="paid" />);
    expect(screen.getByLabelText('Estado: Pagada')).toBeInTheDocument();
  });

  it('has aria-label "Estado: Pendiente" for pending status', () => {
    render(<InvoiceStatusBadge status="pending" />);
    expect(screen.getByLabelText('Estado: Pendiente')).toBeInTheDocument();
  });

  it('has aria-label "Estado: Vencida" for overdue status', () => {
    render(<InvoiceStatusBadge status="overdue" />);
    expect(screen.getByLabelText('Estado: Vencida')).toBeInTheDocument();
  });

  it('has aria-label "Estado: Cancelada" for cancelled status', () => {
    render(<InvoiceStatusBadge status="cancelled" />);
    expect(screen.getByLabelText('Estado: Cancelada')).toBeInTheDocument();
  });
});
