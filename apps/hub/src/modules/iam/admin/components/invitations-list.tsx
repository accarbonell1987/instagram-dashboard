'use client';

import { Badge, Button, DataTable, Td, Th, Tr } from '@core/ui';
import { type JSX } from 'react';

import type { components } from '@/lib/api/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

type InvitationListItem = components['schemas']['InvitationListItem'];
type InvitationStatus = components['schemas']['InvitationStatus'];

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface InvitationsListProps {
  invitations: InvitationListItem[];
  onRevoke: (id: string, email: string) => void;
  isLoading?: boolean;
}

// ─── Status badge ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<InvitationStatus, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  expired: 'Expirada',
  revoked: 'Revocada',
};

const STATUS_CLASS: Record<InvitationStatus, string> = {
  pending: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  accepted: 'bg-muted text-muted-foreground',
  expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  revoked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

function StatusBadge({ status }: { status: InvitationStatus }): JSX.Element {
  return (
    <Badge variant="secondary" className={STATUS_CLASS[status]}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function InvitationSkeleton(): JSX.Element {
  return (
    <div className="flex items-center gap-4 py-3" aria-hidden="true">
      <div className="bg-muted h-4 w-40 animate-pulse rounded" />
      <div className="bg-muted h-4 w-20 animate-pulse rounded" />
      <div className="bg-muted h-5 w-16 animate-pulse rounded-full" />
      <div className="bg-muted h-4 w-28 animate-pulse rounded" />
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function InvitationsList({
  invitations,
  onRevoke,
  isLoading = false,
}: InvitationsListProps): JSX.Element {
  if (isLoading) {
    return (
      <div className="divide-border divide-y">
        {Array.from({ length: 3 }).map((_, i) => (
          <InvitationSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <DataTable
      isEmpty={invitations.length === 0}
      empty={{ text: 'No hay invitaciones' }}
      head={
        <>
          <Th>Email</Th>
          <Th>Rol</Th>
          <Th>Estado</Th>
          <Th>Vence</Th>
          <Th>Acciones</Th>
        </>
      }
    >
          {invitations.map((inv) => (
            <Tr key={inv.id}>
              <Td className="font-medium">{inv.email}</Td>
              <Td className="text-muted-foreground">{inv.role}</Td>
              <Td>
                <StatusBadge status={inv.status} />
              </Td>
              <Td className="text-muted-foreground">
                {new Date(inv.expiresAt).toLocaleDateString('es-PY', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </Td>
              <Td>
                {inv.status === 'pending' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive/80 h-auto px-2 py-1"
                    onClick={() => { onRevoke(inv.id, inv.email); }}
                  >
                    Revocar
                  </Button>
                )}
              </Td>
            </Tr>
          ))}
    </DataTable>
  );
}
