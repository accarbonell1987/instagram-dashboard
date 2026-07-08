'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@core/ui';
import { type JSX } from 'react';

import type { components } from '@/lib/api/types';
import { InlineEditField } from './inline-edit-field';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Tenant = components['schemas']['Tenant'];

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface OrganizationCardProps {
  tenant: Tenant | null;
  isLoading?: boolean;
  onSaveName: (name: string) => Promise<void>;
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function CardSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="bg-muted h-3 w-24 animate-pulse rounded" />
          <div className="bg-muted h-5 w-48 animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Field ─────────────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</dt>
      <dd className="text-foreground text-sm font-medium">{value}</dd>
    </div>
  );
}

// ─── Status label ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<Tenant['status'], string> = {
  pending: 'Pendiente',
  active: 'Activo',
  suspended: 'Suspendido',
};

// ─── Component ─────────────────────────────────────────────────────────────────

export function OrganizationCard({
  tenant,
  isLoading = false,
  onSaveName,
}: OrganizationCardProps): JSX.Element {
  if (isLoading || tenant === null) {
    return (
      <Card>
        <CardContent className="p-6">
          <CardSkeleton />
        </CardContent>
      </Card>
    );
  }

  const creationDate = tenant.createdAt
    ? new Date(tenant.createdAt).toLocaleDateString('es-PY', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '-';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Información de la organización</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-4">
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Nombre de empresa</dt>
            <dd>
              <InlineEditField label="Nombre de empresa" value={tenant.name} onSave={onSaveName} />
            </dd>
          </div>
          <Field label="ID / Slug" value={tenant.slug} />
          <Field label="Estado" value={STATUS_LABEL[tenant.status]} />
          <Field label="Fecha de registro" value={creationDate} />
        </dl>
      </CardContent>
    </Card>
  );
}
