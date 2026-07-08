'use client';

import { Badge, Button } from '@core/ui';
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

  if (invitations.length === 0) {
    return (
      <p className="text-muted-foreground py-4 text-sm">No hay invitaciones</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border border-b">
            <th className="text-muted-foreground py-2 pr-4 text-left font-medium">Email</th>
            <th className="text-muted-foreground py-2 pr-4 text-left font-medium">Rol</th>
            <th className="text-muted-foreground py-2 pr-4 text-left font-medium">Estado</th>
            <th className="text-muted-foreground py-2 pr-4 text-left font-medium">Vence</th>
            <th className="text-muted-foreground py-2 text-left font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {invitations.map((inv) => (
            <tr key={inv.id}>
              <td className="py-3 pr-4 font-medium">{inv.email}</td>
              <td className="text-muted-foreground py-3 pr-4">{inv.role}</td>
              <td className="py-3 pr-4">
                <StatusBadge status={inv.status} />
              </td>
              <td className="text-muted-foreground py-3 pr-4">
                {new Date(inv.expiresAt).toLocaleDateString('es-PY', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </td>
              <td className="py-3">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
