'use client';

import { Badge, Button } from '@core/ui';
import { Unlink } from 'lucide-react';
import type { JSX } from 'react';

import type { LinkedAccount, TenantMember } from '../services/tenant-admin.service';

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface LinkedAccountsAdminProps {
  accounts: LinkedAccount[];
  /** Platform users, keyed by id, so each account can name who holds it. */
  membersById: Map<string, TenantMember>;
  isLoading: boolean;
  error: string;
  /** The account currently being released, if any. */
  busyAccountId: string | null;
  onUnlink: (account: LinkedAccount) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Who holds the account, in the clearest terms available.
 *
 * The account carries a user id; the name behind it comes from the platform. A
 * member who was deleted leaves an id that resolves to nobody — say that
 * plainly instead of printing a raw uuid at an administrator.
 */
function holderLabel(account: LinkedAccount, membersById: Map<string, TenantMember>): string {
  const member = membersById.get(account.userId);
  if (member === undefined) return 'Usuario que ya no está en la organización';
  return member.fullName !== undefined && member.fullName.length > 0
    ? `${member.fullName} · ${member.email}`
    : member.email;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function LinkedAccountsAdmin({
  accounts,
  membersById,
  isLoading,
  error,
  busyAccountId,
  onUnlink,
}: LinkedAccountsAdminProps): JSX.Element {
  if (error !== '') {
    return (
      <p role="alert" className="text-destructive text-sm">
        {error}
      </p>
    );
  }

  if (isLoading) {
    return (
      <div aria-busy="true" aria-label="Cargando cuentas vinculadas" className="flex flex-col gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="bg-muted h-20 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Todavía nadie de tu organización vinculó una cuenta de Instagram.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {accounts.map((account) => {
        const isReleased = account.syncStatus === 'disconnected';
        return (
          <li
            key={account.id}
            className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-foreground font-medium">@{account.username}</span>
                {isReleased ? (
                  <Badge variant="outline" className="text-xs">
                    Liberada
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    {account.accountType}
                  </Badge>
                )}
              </div>
              <span className="text-muted-foreground truncate text-sm">
                {holderLabel(account, membersById)}
              </span>
              <span className="text-muted-foreground text-xs">
                Vinculada el {formatDate(account.connectedAt)}
                {account.followersCount !== null &&
                  ` · ${account.followersCount.toLocaleString('es-PY')} seguidores`}
              </span>
            </div>

            {!isReleased && (
              <Button
                type="button"
                variant="ghost-destructive"
                size="sm"
                onClick={() => {
                  onUnlink(account);
                }}
                disabled={busyAccountId === account.id}
                aria-busy={busyAccountId === account.id}
                aria-label={`Liberar la cuenta @${account.username}`}
              >
                <Unlink className="h-4 w-4" aria-hidden />
                {busyAccountId === account.id ? 'Liberando...' : 'Liberar'}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
