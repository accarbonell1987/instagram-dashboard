'use client';

import { Button } from '@core/ui';
import type { JSX } from 'react';

import type { PendingConnectionRequest } from '@/features/account/services/connection.service';

/**
 * La bandeja del operador de la plataforma.
 *
 * Muestra solicitudes de TODOS los tenants, porque el alta como Instagram Tester
 * se hace una sola vez, en un solo App Dashboard, por una sola persona. La API
 * exige SuperAdmin; acá no se repite esa decisión — un 403 se muestra tal cual.
 *
 * Desaparece cuando Meta apruebe App Review: sin el paso del tester, no hay
 * nada que administrar.
 */
export function ConnectionRequestsAdmin({
  requests,
  onMarkSent,
  busyId,
}: {
  requests: PendingConnectionRequest[];
  onMarkSent: (id: string) => void;
  busyId: string | null;
}): JSX.Element {
  if (requests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No hay solicitudes pendientes.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {requests.map((request) => (
        <li key={request.id} className="border rounded-lg p-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-medium truncate">@{request.username}</p>
            <p className="text-xs text-muted-foreground truncate">
              Tenant {request.tenantId}
            </p>
            <StatusLine request={request} />
          </div>

          {request.status === 'awaiting_invite' && (
            <Button
              size="sm"
              disabled={busyId === request.id}
              onClick={() => { onMarkSent(request.id); }}
            >
              {busyId === request.id ? 'Marcando…' : 'Ya la invité'}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function StatusLine({ request }: { request: PendingConnectionRequest }): JSX.Element {
  switch (request.status) {
    case 'awaiting_invite':
      return (
        <p className="text-xs mt-1 text-amber-600 dark:text-amber-400">
          Falta agregarla como Instagram Tester en el App Dashboard de Meta
        </p>
      );
    case 'invite_sent':
      return (
        <p className="text-xs mt-1 text-muted-foreground">
          Invitación enviada — esperando que el cliente la acepte
        </p>
      );
    case 'failed':
      return (
        <p className="text-xs mt-1 text-destructive">
          Falló: {describeFailure(request.lastError)}
        </p>
      );
    case 'connected':
      return <p className="text-xs mt-1 text-muted-foreground">Conectada</p>;
  }
}

/** El mismo vocabulario que ve el cliente, para hablar de lo mismo con él. */
function describeFailure(reason: string | null): string {
  switch (reason) {
    case 'personal_account':
      return 'la cuenta es personal, no profesional';
    case 'not_a_tester':
      return 'la cuenta no tiene rol en la app';
    case 'invite_not_accepted':
      return 'la invitación no fue aceptada';
    default:
      return reason ?? 'motivo desconocido';
  }
}
