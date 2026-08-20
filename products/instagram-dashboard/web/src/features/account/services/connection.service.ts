'use client'

import { apiFetch } from '@/features/shared/services/instagram-api'
import type {
  ConnectionStatus,
  SyncState,
  SyncTriggerResult,
} from '@/features/shared/types/instagram.types'

// Connecting the Instagram account, and keeping it in sync.
// Split out of a 538-line `instagram.service.ts` that answered for every
// screen at once; a change to carousels meant opening the file the dashboard
// imports too.

/**
 * Fetches the Instagram OAuth authorization URL from the backend.
 * The backend builds the URL with the tenant context encoded in the state param.
 * The frontend then redirects the browser to Instagram.
 */
export async function getOAuthUrl(): Promise<string> {
  const result = await apiFetch<{ success: true; data: { url: string } }>(
    '/api/auth/instagram/authorize'
  );
  return result.data.url;
}

// ── Modules ──

/** Module ids this tenant/user is entitled to for the instagram-dashboard product. */

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  const result = await apiFetch<{ success: true; data: ConnectionStatus }>(
    '/api/auth/instagram/status'
  );
  return result.data;
}

/**
 * Fetches the Instagram OAuth authorization URL from the backend.
 * The backend builds the URL with the tenant context encoded in the state param.
 * The frontend then redirects the browser to Instagram.
 */

// ── Auth ──

export async function disconnectAccount(): Promise<void> {
  await apiFetch<{ success: true; data: unknown }>('/api/auth/instagram/disconnect', {
    method: 'POST',
  });
}

export async function getSyncStatus(): Promise<SyncState> {
  const result = await apiFetch<{ success: true; data: SyncState }>('/api/sync/status');
  return result.data;
}

// ── Dashboard ──

// ── Sync ──

export async function triggerSync(): Promise<SyncTriggerResult> {
  const result = await apiFetch<{ success: true; data: SyncTriggerResult }>('/api/sync/trigger', {
    method: 'POST',
  });
  return result.data;
}

// ── Growth ──

export async function backfillFollowerHistory(): Promise<{ inserted: number }> {
  const result = await apiFetch<{ success: true; data: { inserted: number } }>(
    '/api/sync/backfill',
    { method: 'POST' },
  );
  return result.data;
}
