'use client';

import {
  INSTAGRAM_API,
  PLATFORM_API,
  authorizedFetch,
} from '@/features/shared/services/platform-client';

/**
 * The tenant's connected Instagram accounts, as its administrator sees them.
 *
 * Split out of `tenant-admin.service.ts`, which also held AI usage and the HTTP
 * client — three subjects in one file, so a screen that wanted one imported all
 * three.
 */
export interface LinkedAccount {
  id: string;
  userId: string;
  igUserId: string;
  username: string;
  displayName: string | null;
  profilePictureUrl: string | null;
  followersCount: number | null;
  accountType: string;
  syncStatus: string;
  lastSyncAt: string | null;
  connectedAt: string;
  tokenExpiresAt: string;
}

/**
 * A member of the organisation. Read from api-iam rather than stored here: the
 * name and address belong to the platform, and a local copy would go stale the
 * first time somebody edited their profile.
 */
export interface TenantMember {
  id: string;
  email: string;
  fullName?: string;
}

export async function listLinkedAccounts(): Promise<LinkedAccount[]> {
  const result = await authorizedFetch<{ accounts: LinkedAccount[] }>(
    `${INSTAGRAM_API}/api/admin/linked-accounts`,
  );
  return result.accounts;
}

export async function unlinkAccount(accountId: string): Promise<void> {
  await authorizedFetch(`${INSTAGRAM_API}/api/admin/linked-accounts/${accountId}`, {
    method: 'DELETE',
  });
}

export async function listTenantMembers(): Promise<TenantMember[]> {
  const result = await authorizedFetch<{ items: TenantMember[] }>(
    `${PLATFORM_API}/tenants/current/members`,
  );
  return result.items;
}
