'use client';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@core/ui';
import { Download } from 'lucide-react';
import { useEffect, useState, type JSX } from 'react';

import type { components } from '@/lib/api/types';

import { listInvoices, getInvoiceSignedUrl } from '../services/billing.service';
import { InvoiceStatusBadge } from './invoice-status-badge';

// ─── Types ─────────────────────────────────────────────────────────────────────

type InvoiceListItem = components['schemas']['InvoiceListItem'];

// ─── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatAmount(total: number, currency: string): string {
  if (currency === 'PYG') {
    return `Gs. ${total.toLocaleString('es-PY')}`;
  }
  return `${currency} ${total.toLocaleString('es-PY', { minimumFractionDigits: 2 })}`;
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function InvoiceSkeletonRow(): JSX.Element {
  return (
    <tr aria-hidden="true">
      <td className="py-3 pr-4">
        <div className="bg-muted h-4 w-24 animate-pulse rounded" />
      </td>
      <td className="py-3 pr-4 text-right">
        <div className="bg-muted ml-auto h-4 w-20 animate-pulse rounded" />
      </td>
      <td className="py-3 pr-4">
        <div className="bg-muted h-5 w-20 animate-pulse rounded-full" />
      </td>
      <td className="py-3 text-right">
        <div className="bg-muted ml-auto h-7 w-7 animate-pulse rounded" />
      </td>
    </tr>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function InvoicesSection(): JSX.Element {
  const [items, setItems] = useState<InvoiceListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    listInvoices({ page: 1, pageSize: PAGE_SIZE })
      .then((result) => {
        setItems(result.items);
        setTotal(result.total);
      })
      .catch(() => {
        setLoadError('No pudimos cargar las facturas.');
      })
      .finally(() => {
        setIsLoadingInitial(false);
      });
  }, []);

  async function handleLoadMore(): Promise<void> {
    setIsLoadingMore(true);
    setLoadMoreError(null);
    try {
      const result = await listInvoices({ page: page + 1, pageSize: PAGE_SIZE });
      setItems((prev) => [...prev, ...result.items]);
      setPage((p) => p + 1);
    } catch {
      setLoadMoreError('No pudimos cargar más facturas. Intenta de nuevo.');
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function handleDownload(invoiceId: string): Promise<void> {
    setDownloadingId(invoiceId);
    try {
      const result = await getInvoiceSignedUrl(invoiceId);
      window.open(result.url, '_blank');
    } finally {
      setDownloadingId(null);
    }
  }

  const hasMore = items.length < total;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de facturas</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoadingInitial ? (
          <div
            aria-busy="true"
            aria-label="Cargando facturas"
            className="overflow-x-auto"
          >
            <table className="w-full text-sm">
              <tbody>
                {Array.from({ length: 3 }).map((_, i) => (
                  <InvoiceSkeletonRow key={i} />
                ))}
              </tbody>
            </table>
          </div>
        ) : loadError !== null ? (
          <p role="alert" className="text-destructive text-sm">
            {loadError} Intenta recargar la página.
          </p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground py-4 text-sm">
            Todavía no tenés facturas emitidas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Historial de facturas</caption>
              <thead>
                <tr className="border-border border-b">
                  <th className="text-muted-foreground py-2 pr-4 text-left font-medium">Fecha</th>
                  <th className="text-muted-foreground py-2 pr-4 text-right font-medium">Total</th>
                  <th className="text-muted-foreground py-2 pr-4 text-left font-medium">Estado</th>
                  <th className="text-muted-foreground py-2 text-right font-medium">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((invoice) => {
                  const formattedDate = formatDate(invoice.issuedAt);
                  return (
                    <tr key={invoice.id} className="border-border border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">{formattedDate}</td>
                      <td className="text-foreground py-3 pr-4 text-right tabular-nums">
                        {formatAmount(invoice.total, invoice.currency)}
                      </td>
                      <td className="py-3 pr-4">
                        <InvoiceStatusBadge status={invoice.status} />
                      </td>
                      <td className="py-3 text-right">
                        {invoice.documentId !== null ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-auto px-2 py-1"
                            onClick={() => { void handleDownload(invoice.id); }}
                            disabled={downloadingId === invoice.id}
                            aria-label={`Descargar factura del ${formattedDate}`}
                          >
                            <Download className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoadingInitial && loadError === null && hasMore && (
          <div className="mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { void handleLoadMore(); }}
              disabled={isLoadingMore}
              aria-busy={isLoadingMore ? true : undefined}
            >
              {isLoadingMore ? 'Cargando…' : 'Cargar más'}
            </Button>
            {loadMoreError !== null && (
              <p role="alert" className="text-destructive mt-2 text-sm">
                {loadMoreError}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
