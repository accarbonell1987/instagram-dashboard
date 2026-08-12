'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@core/ui';
import { useEffect, useState, type JSX } from 'react';

import { PaymentStatusBadge } from './payment-status-badge';

import { DataTable, Td, Th, Tr } from '@/components/data-table';
import type { components } from '@/lib/api/types';
import { listTenantPayments } from '@/modules/shared/billing/services/billing.service';

type Payment = components['schemas']['Payment'];

const METHOD_LABELS: Record<string, string> = {
  bancard: 'Tarjeta',
  bank_transfer: 'Transferencia bancaria',
};

/**
 * How the payment came to be settled, in the customer's terms. The API also
 * reports *who* settled it; that is an internal detail and is deliberately not
 * shown here — the tenant needs to know a human reviewed it, not which one.
 */
const SETTLEMENT_LABELS: Record<string, string> = {
  webhook: 'Confirmado automáticamente',
  agent: 'Verificado por nuestro equipo',
  manual_admin: 'Activado manualmente',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatAmount(amount: number, currency: string): string {
  return `${amount.toLocaleString('es-PY')} ${currency}`;
}

function PaymentSkeletonRow(): JSX.Element {
  return (
    <Tr aria-hidden>
      <Td>
        <div className="bg-muted h-4 w-20 animate-pulse rounded" />
      </Td>
      <Td align="right">
        <div className="bg-muted ml-auto h-4 w-24 animate-pulse rounded" />
      </Td>
      <Td>
        <div className="bg-muted h-4 w-32 animate-pulse rounded" />
      </Td>
      <Td>
        <div className="bg-muted h-5 w-20 animate-pulse rounded-full" />
      </Td>
    </Tr>
  );
}

export function PaymentsSection(): JSX.Element {
  const [items, setItems] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    listTenantPayments()
      .then((result) => {
        if (!cancelled) setItems(result.items);
      })
      .catch(() => {
        if (!cancelled) setError('No pudimos cargar tus pagos. Recargá la página.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagos</CardTitle>
        <p className="text-muted-foreground text-sm">
          Todo lo que pagaste, con la fecha y el medio que usaste.
        </p>
      </CardHeader>
      <CardContent>
        <DataTable
          variant="bare"
          isLoading={isLoading}
          loadingLabel="Cargando pagos"
          loadingRows={Array.from({ length: 3 }).map((_, i) => (
            <PaymentSkeletonRow key={i} />
          ))}
          error={error}
          isEmpty={items.length === 0}
          empty={{ text: 'Todavía no registramos ningún pago.' }}
          caption="Historial de pagos"
          head={
            <>
              <Th>Fecha</Th>
              <Th align="right">Monto</Th>
              <Th>Medio</Th>
              <Th>Estado</Th>
            </>
          }
        >
          {items.map((payment) => (
            <Tr key={payment.id}>
              <Td className="font-medium">{formatDate(payment.createdAt)}</Td>
              <Td align="right" className="tabular-nums">
                {formatAmount(payment.amount, payment.currency)}
              </Td>
              <Td>
                <div>{METHOD_LABELS[payment.method] ?? payment.method}</div>
                {payment.reference != null && payment.reference !== '' && (
                  <div className="text-muted-foreground font-mono text-xs">
                    {payment.reference}
                  </div>
                )}
              </Td>
              <Td>
                <PaymentStatusBadge status={payment.status} />
                {payment.settlementKind != null && (
                  <div className="text-muted-foreground mt-0.5 text-xs">
                    {SETTLEMENT_LABELS[payment.settlementKind] ?? payment.settlementKind}
                  </div>
                )}
                {/* The settlement note is written for the customer to read —
                    it is what the agent saw, or why the payment was refused. */}
                {payment.note != null && payment.note !== '' && (
                  <p className="text-muted-foreground mt-0.5 text-xs italic">{payment.note}</p>
                )}
              </Td>
            </Tr>
          ))}
        </DataTable>
      </CardContent>
    </Card>
  );
}
