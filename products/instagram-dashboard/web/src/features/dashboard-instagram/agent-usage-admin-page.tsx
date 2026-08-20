'use client';

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';

import {
  UsageByOperationChart,
  UsageByUserChart,
  UsageOverTimeChart,
} from './components/usage-charts';
import { initHubToken, reportHeightToHub, subscribeToToken } from './lib/hub-token';
import {
  getUsageBreakdown,
  listTenantMembers,
  type TenantMember,
  type UsageBreakdown,
} from './services/tenant-admin.service';

const WINDOWS = [
  { days: 1, label: 'Hoy' },
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
] as const;

const formatNumber = (value: number): string => value.toLocaleString('es-PY');

/**
 * What the tenant's AI has consumed, in total and by member.
 *
 * Mounted in the hub's iframe like its sibling admin pages, so it completes the
 * token handshake and reports its own height.
 */
export function AgentUsageAdminPage(): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);

  const [days, setDays] = useState<number>(30);
  const [breakdown, setBreakdown] = useState<UsageBreakdown | null>(null);
  const [membersById, setMembersById] = useState<Map<string, TenantMember>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => initHubToken(), []);

  useEffect(() => {
    const element = rootRef.current;
    if (element === null) return;
    return reportHeightToHub(element);
  }, [breakdown, isLoading]);

  const load = useCallback(async (windowDays: number): Promise<void> => {
    setIsLoading(true);
    setError('');
    try {
      // Names are a nicety; failing to get them should not hide the figures, so
      // they degrade to an empty map and the rows fall back to the raw id.
      const [usage, members] = await Promise.all([
        getUsageBreakdown(windowDays),
        listTenantMembers().catch(() => [] as TenantMember[]),
      ]);
      setBreakdown(usage);
      setMembersById(new Map(members.map((member) => [member.id, member])));
    } catch {
      setError('No pudimos cargar el consumo. Volvé a intentarlo en un momento.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let started = false;
    return subscribeToToken((token) => {
      if (token === null || started) return;
      started = true;
      void load(days);
    });
    // Deliberately not re-subscribing per window: the picker calls load itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const pick = (windowDays: number): void => {
    setDays(windowDays);
    void load(windowDays);
  };

  const nameFor = (userId: string | null): string => {
    // The rows that predate attribution. Named rather than hidden: dropping
    // them would leave the members not adding up to the total.
    if (userId === null) return 'Sin atribuir';
    const member = membersById.get(userId);
    return member?.fullName ?? member?.email ?? userId;
  };

  return (
    <div ref={rootRef} className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {WINDOWS.map((window) => (
          <button
            key={window.days}
            type="button"
            onClick={() => { pick(window.days); }}
            aria-pressed={days === window.days}
            className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
              days === window.days
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {window.label}
          </button>
        ))}
      </div>

      {error !== '' && <p className="text-destructive text-sm">{error}</p>}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Cargando…</p>
      ) : breakdown === null ? null : breakdown.total.calls === 0 ? (
        <p className="text-muted-foreground text-sm">
          No hay consumo registrado en este período.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Mensajes', breakdown.total.messages],
              ['Tokens', breakdown.total.tokens],
              ['Imágenes', breakdown.total.images],
              ['Llamadas', breakdown.total.calls],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-lg border p-3">
                <dt className="text-muted-foreground text-xs">{label}</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {formatNumber(value as number)}
                </dd>
              </div>
            ))}
          </dl>

          <UsageOverTimeChart daily={breakdown.daily} />

          <div className="grid gap-3 lg:grid-cols-2">
            <UsageByUserChart
              data={breakdown.byUser}
              metric="tokens"
              title="Tokens por miembro"
              hint="Quién consume el presupuesto"
              nameFor={nameFor}
            />
            <UsageByUserChart
              data={breakdown.byUser}
              metric="messages"
              title="Mensajes por miembro"
              hint="Conversaciones con el agente"
              nameFor={nameFor}
            />
          </div>

          <UsageByOperationChart data={breakdown.byOperation} />

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Miembro</th>
                  <th className="px-3 py-2 text-right font-medium">Mensajes</th>
                  <th className="px-3 py-2 text-right font-medium">Tokens</th>
                  <th className="px-3 py-2 text-right font-medium">Imágenes</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.byUser.map((row) => (
                  <tr key={row.userId ?? 'unattributed'} className="border-t">
                    <td className="px-3 py-2">{nameFor(row.userId)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatNumber(row.messages)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatNumber(row.tokens)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatNumber(row.images)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
