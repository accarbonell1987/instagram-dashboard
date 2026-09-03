'use client';

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';

import { ConnectionRequestsAdmin } from './components/connection-requests-admin';

import {
  listPendingConnectionRequests,
  markInviteSent,
  type PendingConnectionRequest,
} from '@/features/account/services/connection.service';
import { initHubToken, reportHeightToHub, subscribeToToken } from '@/features/shared/lib/hub-token';
import { PlatformError } from '@/features/shared/services/platform-client';

/**
 * Bandeja de solicitudes de conexión, dentro de la sección de configuración del
 * hub — el mismo iframe que usa el resto del producto, así que hay que completar
 * el handshake del token y reportar la altura propia.
 *
 * Sólo un SuperAdmin ve datos acá: la API responde 403 a cualquier otro y la
 * pantalla lo dice sin inventar una explicación.
 */
export function ConnectionRequestsAdminPage(): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);

  const [requests, setRequests] = useState<PendingConnectionRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => initHubToken(), []);

  const load = useCallback(async () => {
    try {
      setRequests(await listPendingConnectionRequests());
      setError('');
    } catch (err) {
      setError(
        err instanceof PlatformError && err.status === 403
          ? 'Esta sección es sólo para administradores de la plataforma.'
          : 'No pudimos cargar las solicitudes.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => subscribeToToken(() => { void load(); }), [load]);

  useEffect(() => {
    if (rootRef.current) reportHeightToHub(rootRef.current);
  });

  const handleMarkSent = useCallback(
    (id: string) => {
      setBusyId(id);
      void markInviteSent(id)
        .then(() => load())
        .catch(() => { setError('No pudimos marcar esa solicitud.'); })
        .finally(() => { setBusyId(null); });
    },
    [load],
  );

  return (
    <div ref={rootRef} className="space-y-4 p-6">
      <div>
        <h1 className="text-lg font-semibold">Solicitudes de conexión</h1>
        <p className="text-sm text-muted-foreground">
          Cuentas esperando el alta como Instagram Tester en el App Dashboard de
          Meta.
        </p>
      </div>

      {error !== '' && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Cargando…</p>
      ) : (
        error === '' && (
          <ConnectionRequestsAdmin
            requests={requests}
            onMarkSent={handleMarkSent}
            busyId={busyId}
          />
        )
      )}
    </div>
  );
}
