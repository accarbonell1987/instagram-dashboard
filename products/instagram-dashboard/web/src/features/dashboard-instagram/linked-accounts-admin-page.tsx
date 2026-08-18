'use client';

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';

import { LinkedAccountsAdmin } from './components/linked-accounts-admin';
import { initHubToken, reportHeightToHub, subscribeToToken } from './lib/hub-token';
import {
  listLinkedAccounts,
  listTenantMembers,
  unlinkAccount,
  TenantAdminError,
  type LinkedAccount,
  type TenantMember,
} from './services/tenant-admin.service';

/**
 * The tenant's Instagram accounts, administered from the hub's settings area.
 *
 * The hub mounts this in the same iframe it uses for the product itself, so the
 * page has to do two things it would not do standalone: complete the token
 * handshake, and report its own height — inside the settings layout it is a
 * panel, and nothing outside the frame can measure it.
 */
export function LinkedAccountsAdminPage(): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);

  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [membersById, setMembersById] = useState<Map<string, TenantMember>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);

  useEffect(() => initHubToken(), []);

  useEffect(() => {
    const element = rootRef.current;
    if (element === null) return;
    return reportHeightToHub(element);
  }, []);

  const load = useCallback(async (): Promise<void> => {
    setError('');
    try {
      // The member list only names the holders; failing to get it should not
      // hide the accounts themselves, so it degrades to an empty map.
      const [linked, members] = await Promise.all([
        listLinkedAccounts(),
        listTenantMembers().catch(() => [] as TenantMember[]),
      ]);
      setAccounts(linked);
      setMembersById(new Map(members.map((member) => [member.id, member])));
    } catch (err: unknown) {
      setError(
        err instanceof TenantAdminError && err.status === 403
          ? 'Necesitás ser administrador de la organización para ver esta pantalla.'
          : 'No pudimos cargar las cuentas vinculadas. Recargá la página.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  // The hub pushes the token by postMessage after mount, so the first render
  // has none. Waiting for it beats firing a request that is certain to 401.
  useEffect(() => {
    let started = false;
    return subscribeToToken((token) => {
      if (token === null || started) return;
      started = true;
      void load();
    });
  }, [load]);

  async function handleUnlink(account: LinkedAccount): Promise<void> {
    setBusyAccountId(account.id);
    setError('');
    try {
      await unlinkAccount(account.id);
      await load();
    } catch {
      setError(`No pudimos liberar la cuenta @${account.username}. Intentá de nuevo.`);
    } finally {
      setBusyAccountId(null);
    }
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-4 p-1">
      <p className="text-muted-foreground text-sm">
        Cada persona de tu organización puede vincular su cuenta de Instagram. Liberar una cuenta
        corta el vínculo y deja que otra persona la conecte.
      </p>

      <LinkedAccountsAdmin
        accounts={accounts}
        membersById={membersById}
        isLoading={isLoading}
        error={error}
        busyAccountId={busyAccountId}
        onUnlink={(account) => void handleUnlink(account)}
      />
    </div>
  );
}
