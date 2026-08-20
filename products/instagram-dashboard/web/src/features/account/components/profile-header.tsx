import { Badge } from '@core/ui';
import { Globe } from 'lucide-react';
import type { ReactNode } from 'react';

import type { InstagramProfile } from '@/features/dashboard-instagram/types/instagram.types';

/** "hace 5 minutos" — an "Actualizado" badge alone never says since when. */
function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'recién';
  if (minutes < 60) return `hace ${String(minutes)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${String(hours)} h`;
  return `hace ${String(Math.round(hours / 24))} d`;
}

/** The bare host: `https://www.tiomono.py/` reads as `tiomono.py`. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}

export function ProfileHeader({
  profile,
  lastSyncAt,
  connectedBy,
  rightContent,
}: {
  profile: InstagramProfile;
  lastSyncAt?: string | null;
  /**
   * The member of the organisation this account is connected under. Each member
   * connects their own, so the card showed an Instagram handle with no hint of
   * which of your logins was looking at it.
   */
  connectedBy?: { email: string; fullName?: string } | null;
  rightContent?: ReactNode;
}) {
  const followRatio =
    profile.followingCount > 0
      ? (profile.followersCount / profile.followingCount).toFixed(1)
      : null;

  return (
    <div className="bg-card border-border rounded-lg border p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Identity */}
        <div className="flex min-w-0 items-center gap-4">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt={profile.username}
              className="border-border h-16 w-16 shrink-0 rounded-full border-2 object-cover"
            />
          ) : (
            <div className="bg-muted text-muted-foreground border-border flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 text-2xl font-bold uppercase">
              {profile.username.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold">{profile.fullName}</h2>
              {profile.isVerified && (
                <Badge variant="secondary" className="text-[10px]">
                  Verificado
                </Badge>
              )}
              {profile.isBusiness && (
                <Badge variant="outline" className="text-[10px]">
                  Empresa
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">@{profile.username}</p>
            {profile.bio !== '' && (
              <p className="text-muted-foreground mt-0.5 line-clamp-1 text-sm">{profile.bio}</p>
            )}
            {connectedBy != null && (
              <p className="text-muted-foreground mt-1 truncate text-xs" title={connectedBy.email}>
                Conectada por{' '}
                <span className="text-foreground font-medium">{connectedBy.email}</span>
              </p>
            )}
            {profile.website !== undefined && profile.website !== '' && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary mt-1 inline-flex items-center gap-1 text-xs hover:underline"
              >
                <Globe className="h-3 w-3" aria-hidden="true" />
                {hostOf(profile.website)}
              </a>
            )}
          </div>
        </div>

        {/*
          The figures, spread across the width the card now has. They used to be
          a line of small text under the name — legible, but the same weight as
          the handle, so the numbers people come here to read looked like
          caption.
        */}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Stat label="posts" value={profile.postsCount.toLocaleString('es-PY')} />
          <Stat label="seguidores" value={profile.followersCount.toLocaleString('es-PY')} />
          <Stat label="siguiendo" value={profile.followingCount.toLocaleString('es-PY')} />
          {followRatio !== null && (
            // A brand follows few and is followed by many; the ratio says that
            // in one number where two counts need comparing.
            <Stat label="seguidores por seguido" value={`${followRatio}×`} />
          )}
        </div>

        {rightContent !== undefined && (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <div className="flex items-center gap-1">{rightContent}</div>
            {lastSyncAt !== undefined && lastSyncAt !== null && (
              <p className="text-muted-foreground text-[11px]">
                Sincronizado {relativeTime(lastSyncAt)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
