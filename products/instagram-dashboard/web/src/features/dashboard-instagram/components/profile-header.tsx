import { Badge } from '@core/ui';
import type { ReactNode } from 'react';

import type { InstagramProfile } from '../types/instagram.types';

export function ProfileHeader({
  profile,
  rightContent,
}: {
  profile: InstagramProfile;
  rightContent?: ReactNode;
}) {
  return (
    <div className="bg-card border-border rounded-lg border p-6">
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-center gap-4 min-w-0">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt={profile.username}
            className="border-border h-16 w-16 rounded-full border-2 object-cover"
          />
        ) : (
          <div className="bg-muted text-muted-foreground border-border flex h-16 w-16 items-center justify-center rounded-full border-2 text-2xl font-bold uppercase">
            {profile.username.charAt(0)}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-semibold">{profile.fullName}</h2>
            {profile.isVerified && (
              <Badge variant="secondary" className="text-[10px]">
                Verificado
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">@{profile.username}</p>
          <p className="text-muted-foreground mt-0.5 line-clamp-1 text-sm">{profile.bio}</p>
          <div className="text-muted-foreground mt-2 flex gap-4 text-xs">
            <span>
              <strong className="text-foreground">{profile.postsCount.toLocaleString()}</strong>{' '}
              posts
            </span>
            <span>
              <strong className="text-foreground">{profile.followersCount.toLocaleString()}</strong>{' '}
              seguidores
            </span>
            <span>
              <strong className="text-foreground">{profile.followingCount.toLocaleString()}</strong>{' '}
              siguiendo
            </span>
          </div>
        </div>
        </div>

        {/* Right side: sync status + disconnect */}
        {rightContent !== undefined && (
          <div className="flex shrink-0 items-center gap-1">
            {rightContent}
          </div>
        )}
      </div>
    </div>
  );
}
