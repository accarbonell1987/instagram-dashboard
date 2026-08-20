'use client';

import { INSTAGRAM_API, authorizedFetch } from '@/features/shared/services/platform-client';

/**
 * What the agent has consumed, for the tenant and per member.
 *
 * `userId` is null on calls made before the column existed. Those are reported
 * under their own entry rather than dropped or spread over the current members:
 * dropping them stops the rows adding up to the total, and spreading them
 * credits calls to people who did not make them.
 */
export interface UsageTotals {
  tokens: number;
  images: number;
  calls: number;
  /** Chat operations — what the daily allowance counts. */
  messages: number;
}

export interface UsageByUser extends UsageTotals {
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

export async function getUsageBreakdown(days: number): Promise<UsageBreakdown> {
  return authorizedFetch<UsageBreakdown>(
    `${INSTAGRAM_API}/api/admin/usage?days=${String(days)}`,
  );
}
