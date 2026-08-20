'use client';

import { getHubToken, clearHubToken } from '@/features/shared/lib/hub-token';
;

// ── API base URL ──
export const API_BASE = process.env['NEXT_PUBLIC_INSTAGRAM_API_URL'] ?? 'http://localhost:3003'

/**
 * Resolve a carousel slide imageUrl for display in the browser.
 * New images are stored as relative paths (/carousels/...). Old images may be
 * stored as absolute URLs (ngrok, etc.) — strip their origin and rebase to the
 * local API server so they always load correctly in development.
 */
export function resolveImageUrl(imageUrl: string): string {
  if (imageUrl.startsWith('/')) return `${API_BASE}${imageUrl}`
  try {
    const url = new URL(imageUrl)
    return `${API_BASE}${url.pathname}`
  } catch {
    return imageUrl
  }
}

export class InstagramApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'InstagramApiError'
  }
}

// ── Thin fetch wrapper ──
// Targets the Instagram API origin. Injects the Hub JWT (from getHubToken(),
// delivered via postMessage) so the backend can verify tenant context via
// api-iam JWKS.
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };

  const token = getHubToken();
  if (token !== null) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Only clear the token if this request actually carried one — otherwise
    // we may race with a concurrent postMessage delivery that arrived between
    // this request's dispatch (without token) and the 401 response.
    if (token !== null) {
      clearHubToken();
    }
    throw new Error('Session expired. Please log in again.');
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Instagram API error ${String(response.status)}: ${text || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

// ── Modules ──

/** Module ids this tenant/user is entitled to for the instagram-dashboard product. */
export async function getMyModules(): Promise<string[]> {
  const result = await apiFetch<{ success: true; data: { moduleIds: string[] } }>(
    '/api/me/modules',
  );
  return result.data.moduleIds;
}

// ── Sync ──
