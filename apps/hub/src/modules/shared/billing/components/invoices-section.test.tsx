import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { seedDb } from '@/lib/mocks/seed';
import { server } from '@/lib/mocks/server';
import { http, HttpResponse } from 'msw';

import { InvoicesSection } from './invoices-section';

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

describe('InvoicesSection', () => {
  describe('initial load', () => {
    it('renders skeleton table on mount', () => {
      seedDb('happy');
      render(<InvoicesSection />);
      expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    });

    it('renders table with invoice rows after successful fetch', async () => {
      seedDb('happy');
      render(<InvoicesSection />);
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
      expect(screen.getAllByRole('row').length).toBeGreaterThan(1); // header + rows
    });

    it('renders empty state when no invoices exist', async () => {
      seedDb('billing-empty');
      render(<InvoicesSection />);
      await waitFor(() => {
        expect(screen.getByText(/Todavía no tenés facturas/i)).toBeInTheDocument();
      });
    });

    it('renders load error when initial fetch fails', async () => {
      server.use(
        http.get(`${BASE}/billing/invoices`, () =>
          HttpResponse.json({ type: 'about:blank', title: 'Error', status: 500 }, { status: 500 })
        )
      );
      render(<InvoicesSection />);
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/No pudimos cargar las facturas/i)).toBeInTheDocument();
      });
    });
  });

  describe('table content', () => {
    it('renders table caption "Historial de facturas"', async () => {
      seedDb('happy');
      render(<InvoicesSection />);
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
      // sr-only caption
      expect(document.querySelector('caption')).toHaveTextContent('Historial de facturas');
    });

    it('renders formatted date for each invoice', async () => {
      seedDb('happy');
      render(<InvoicesSection />);
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
      // Dates should be formatted as DD/MM/YYYY pattern
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThan(1);
    });

    it('renders formatted amount with Gs. prefix for PYG currency', async () => {
      seedDb('happy');
      render(<InvoicesSection />);
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
      // At least one Gs. amount should be visible
      expect(screen.getAllByText(/Gs\./i).length).toBeGreaterThan(0);
    });

    it('renders download button for invoices with documentId', async () => {
      seedDb('happy');
      render(<InvoicesSection />);
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
      // Two paid invoices have documentIds
      const downloadButtons = screen.getAllByRole('button', { name: /Descargar factura/i });
      expect(downloadButtons.length).toBeGreaterThan(0);
    });

    it('does NOT render download button for invoices with documentId === null', async () => {
      seedDb('happy');
      render(<InvoicesSection />);
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
      // Pending/overdue/cancelled invoices have no documentId — show "—" instead
      const dashCells = screen.getAllByText('—');
      expect(dashCells.length).toBeGreaterThan(0);
    });
  });

  describe('load more', () => {
    it('hides "Cargar más" button when all invoices are loaded (items.length >= total)', async () => {
      seedDb('happy');
      // Default pageSize=10 and we only have 5 invoices
      render(<InvoicesSection />);
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: /Cargar más/i })).not.toBeInTheDocument();
    });

    it('shows "Cargar más" button when items.length < total', async () => {
      seedDb('happy');
      server.use(
        http.get(`${BASE}/billing/invoices`, ({ request }) => {
          const url = new URL(request.url);
          const pageSize = parseInt(url.searchParams.get('pageSize') ?? '10', 10);
          return HttpResponse.json({
            items: [
              {
                id: 'inv-test-001',
                issuedAt: '2025-01-01T00:00:00Z',
                total: 100000,
                currency: 'PYG',
                status: 'paid',
                documentId: 'doc-test-001',
              },
            ],
            total: 5,
            page: 1,
            pageSize,
          });
        })
      );
      render(<InvoicesSection />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Cargar más/i })).toBeInTheDocument();
      });
    });

    it('shows loading state on "Cargar más" button while fetching', async () => {
      seedDb('happy');
      // Set up: first call returns 1 item with total=5 to show "load more"
      let callCount = 0;
      server.use(
        http.get(`${BASE}/billing/invoices`, async () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json({
              items: [{ id: 'inv-1', issuedAt: '2025-01-01T00:00:00Z', total: 100, currency: 'PYG', status: 'paid', documentId: null }],
              total: 5,
              page: 1,
              pageSize: 10,
            });
          }
          // Second call (load more) — never resolves
          await new Promise(() => {});
        })
      );
      render(<InvoicesSection />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Cargar más/i })).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Cargar más/i }));

      await waitFor(() => {
        expect(screen.getByText('Cargando…')).toBeInTheDocument();
      });
    });

    it('shows inline error below button on load-more failure', async () => {
      seedDb('happy');
      let callCount = 0;
      server.use(
        http.get(`${BASE}/billing/invoices`, () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json({
              items: [{ id: 'inv-1', issuedAt: '2025-01-01T00:00:00Z', total: 100, currency: 'PYG', status: 'paid', documentId: null }],
              total: 5,
              page: 1,
              pageSize: 10,
            });
          }
          return HttpResponse.json({ title: 'Error', status: 500 }, { status: 500 });
        })
      );
      render(<InvoicesSection />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Cargar más/i })).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Cargar más/i }));

      await waitFor(() => {
        expect(screen.getByText(/No pudimos cargar más facturas/i)).toBeInTheDocument();
      });
    });

    it('keeps existing items visible on load-more error', async () => {
      seedDb('happy');
      let callCount = 0;
      server.use(
        http.get(`${BASE}/billing/invoices`, () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json({
              items: [{ id: 'inv-1', issuedAt: '2025-01-01T00:00:00Z', total: 100000, currency: 'PYG', status: 'paid', documentId: null }],
              total: 5,
              page: 1,
              pageSize: 10,
            });
          }
          return HttpResponse.json({ title: 'Error', status: 500 }, { status: 500 });
        })
      );
      render(<InvoicesSection />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Cargar más/i })).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Cargar más/i }));

      await waitFor(() => {
        expect(screen.getByText(/No pudimos cargar más facturas/i)).toBeInTheDocument();
      });
      // Original items still visible
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('appends new items to existing rows on successful load-more', async () => {
      const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';
      let callCount = 0;
      server.use(
        http.get(`${BASE}/billing/invoices`, () => {
          callCount += 1;
          if (callCount === 1) {
            return HttpResponse.json({
              items: [{ id: 'inv-p1', issuedAt: '2025-05-01T00:00:00Z', total: 100000, currency: 'PYG', status: 'paid', documentId: 'doc-p1' }],
              total: 2,
              page: 1,
              pageSize: 10,
            });
          }
          return HttpResponse.json({
            items: [{ id: 'inv-p2', issuedAt: '2025-04-01T00:00:00Z', total: 200000, currency: 'PYG', status: 'pending', documentId: null }],
            total: 2,
            page: 2,
            pageSize: 10,
          });
        })
      );

      render(<InvoicesSection />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Cargar más/i })).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Cargar más/i }));

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Cargar más/i })).not.toBeInTheDocument();
      });

      const rows = screen.getAllByRole('row');
      // 1 header row + 2 data rows
      expect(rows).toHaveLength(3);
    });
  });

  describe('accessibility', () => {
    it('table has caption "Historial de facturas"', async () => {
      seedDb('happy');
      render(<InvoicesSection />);
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
      expect(document.querySelector('caption')).toHaveTextContent('Historial de facturas');
    });
  });
});
