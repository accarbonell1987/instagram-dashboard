'use client';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@core/ui';
import { Download } from 'lucide-react';
import { useEffect, useState, type JSX } from 'react';


import { listInvoices, getInvoiceSignedUrl } from '../services/billing.service';

import { InvoiceStatusBadge } from './invoice-status-badge';

import { DataTable, Td, Th, Tr } from '@/components/data-table';
import type { components } from '@/lib/api/types';

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
    <Tr aria-hidden>
      <Td>
        <div className="bg-muted h-4 w-24 animate-pulse rounded" />
      </Td>
      <Td align="right">
        <div className="bg-muted ml-auto h-4 w-20 animate-pulse rounded" />
      </Td>
      <Td>
        <div className="bg-muted h-5 w-20 animate-pulse rounded-full" />
      </Td>
      <Td align="right">
        <div className="bg-muted ml-auto h-7 w-7 animate-pulse rounded" />
      </Td>
    </Tr>
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
        <DataTable
          variant="bare"
          isLoading={isLoadingInitial}
          loadingRows={Array.from({ length: 3 }).map((_, i) => (
            <InvoiceSkeletonRow key={i} />
          ))}
          loadingLabel="Cargando facturas"
          error={loadError !== null ? `${loadError} Intenta recargar la página.` : ''}
          isEmpty={items.length === 0}
          empty={{ text: 'Todavía no tenés facturas emitidas.' }}
          caption="Historial de facturas"
          head={
            <>
              <Th>Fecha</Th>
              <Th align="right">Total</Th>
              <Th>Estado</Th>
              <Th align="right">
                <span className="sr-only">Acciones</span>
              </Th>
            </>
          }
        >
                {items.map((invoice) => {
                  const formattedDate = formatDate(invoice.issuedAt);
                  return (
                    <Tr key={invoice.id}>
                      <Td className="font-medium">{formattedDate}</Td>
                      <Td align="right" className="text-foreground tabular-nums">
                        {formatAmount(invoice.total, invoice.currency)}
                      </Td>
                      <Td>
                        <InvoiceStatusBadge status={invoice.status} />
                      </Td>
                      <Td align="right">
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
                      </Td>
                    </Tr>
                  );
                })}
        </DataTable>

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
