'use client';

import { getHubToken } from '../lib/hub-token';

// ── Types ─────────────────────────────────────────────────────────────────────

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

/** The platform user behind `LinkedAccount.userId`. Resolved from api-iam. */
export interface UsageTotals {
  tokens: number;
  images: number;
  calls: number;
  /** Chat operations — what the daily allowance counts. */
  messages: number;
}

export interface UsageByUser extends UsageTotals {
  /** Null for calls made before attribution existed. */
  userId: string | null;
}

export interface UsageByOperation extends UsageTotals {
  operation: string;
}

export interface UsageDay extends UsageTotals {
  date: string;
}

export interface UsageBreakdown {
  total: UsageTotals;
  byUser: UsageByUser[];
  byOperation: UsageByOperation[];
  daily: UsageDay[];
  since: string;
}

export interface TenantMember {
  id: string;
  email: string;
  fullName?: string;
}

// ── Bases ─────────────────────────────────────────────────────────────────────

const API_BASE = process.env['NEXT_PUBLIC_INSTAGRAM_API_URL'] ?? 'http://localhost:3003';

/**
 * The platform API. This screen names the person who holds each account, and
 * that name lives in api-iam, not in this product's database — storing a copy
 * here would go stale the first time somebody edits their profile.
 *
 * The same hub token authorises both calls, and `/tenants/current/members` is
 * admin-only on its own, so nothing is widened by reading it from here.
 */
const PLATFORM_BASE = process.env['NEXT_PUBLIC_PLATFORM_API_URL'] ?? 'http://localhost:8080';

export class TenantAdminError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'TenantAdminError';
  }
}

async function authorizedFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getHubToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token !== null ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    throw new TenantAdminError(response.status, `Request failed with ${String(response.status)}`);
  }

  return response.json() as Promise<T>;
}

// ── Calls ─────────────────────────────────────────────────────────────────────

export async function listLinkedAccounts(): Promise<LinkedAccount[]> {
  const result = await authorizedFetch<{ accounts: LinkedAccount[] }>(
    `${API_BASE}/api/admin/linked-accounts`,
  );
  return result.accounts;
}

export async function unlinkAccount(accountId: string): Promise<void> {
  await authorizedFetch(`${API_BASE}/api/admin/linked-accounts/${accountId}`, {
    method: 'DELETE',
  });
}

export async function listTenantMembers(): Promise<TenantMember[]> {
  const result = await authorizedFetch<{ items: TenantMember[] }>(
    `${PLATFORM_BASE}/tenants/current/members`,
  );
  return result.items;
}

export async function getUsageBreakdown(days: number): Promise<UsageBreakdown> {
  return authorizedFetch<UsageBreakdown>(
    `${API_BASE}/api/admin/usage?days=${String(days)}`,
  );
}

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
}

/**
 * Who is signed in, from the platform rather than from this product.
 *
 * The account's owner is a `user_id` here and nothing else — the email lives in
 * api-iam, and a copy kept locally would go stale the first time somebody
 * changes it. Unlike the member list this needs no admin role: it answers only
 * about the caller.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const result = await authorizedFetch<{ user: CurrentUser }>(`${PLATFORM_BASE}/auth/me`);
  return result.user;
}

