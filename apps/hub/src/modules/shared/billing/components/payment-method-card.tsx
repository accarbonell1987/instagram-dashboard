'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@core/ui';
import { CreditCard } from 'lucide-react';
import type { JSX } from 'react';

import type { components } from '@/lib/api/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

type PaymentMethod = components['schemas']['PaymentMethod'];

// ─── Brand label map ────────────────────────────────────────────────────────────

const BRAND_LABEL: Record<PaymentMethod['brand'], string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'Amex',
  unknown: 'Tarjeta',
};

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface PaymentMethodCardProps {
  paymentMethod: PaymentMethod | null;
  isLoading: boolean;
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function PaymentMethodSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      <div className="bg-muted h-5 w-16 animate-pulse rounded" />
      <div className="bg-muted h-5 w-56 animate-pulse rounded" />
      <div className="bg-muted h-3 w-24 animate-pulse rounded" />
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function PaymentMethodCard({ paymentMethod, isLoading }: PaymentMethodCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Método de pago</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div aria-busy="true" aria-label="Cargando método de pago">
            <PaymentMethodSkeleton />
          </div>
        ) : paymentMethod === null ? (
          <div className="flex flex-col items-start gap-2 py-2">
            <div className="flex items-center gap-2">
              <CreditCard className="text-muted-foreground h-5 w-5" aria-hidden="true" />
              <span className="text-muted-foreground text-sm">
                Aún no registraste un método de pago
              </span>
            </div>
          </div>
        ) : (
          <div
            className="flex flex-col gap-1"
            aria-label={`Tarjeta ${BRAND_LABEL[paymentMethod.brand]} terminada en ${paymentMethod.lastFour}`}
          >
            <div className="flex items-center gap-2">
              <CreditCard className="text-muted-foreground h-5 w-5" aria-hidden="true" />
              <span className="text-foreground text-sm font-medium uppercase tracking-wide">
                {BRAND_LABEL[paymentMethod.brand]}
              </span>
            </div>
            <p aria-hidden="true" className="text-foreground font-mono text-base tracking-wider">
              •••• •••• •••• {paymentMethod.lastFour}
            </p>
            <p className="text-muted-foreground text-xs">
              Vence {String(paymentMethod.expiryMonth).padStart(2, '0')}/{String(paymentMethod.expiryYear).slice(-2)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
