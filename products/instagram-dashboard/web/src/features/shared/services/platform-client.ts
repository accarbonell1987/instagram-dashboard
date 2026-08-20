'use client';

import { getHubToken } from '@/features/shared/lib/hub-token';

/**
 * The two APIs this product talks to, and the one way it authenticates to both.
 *
 * Extracted from what used to be `tenant-admin.service.ts`, which carried the
 * client alongside linked accounts and AI usage — three subjects in one file,
 * so every screen that needed the fetch helper imported the other two with it.
 */
export const INSTAGRAM_API =
  process.env['NEXT_PUBLIC_INSTAGRAM_API_URL'] ?? 'http://localhost:3003';

/**
 * api-iam. Some answers live there and not here: the member behind a `user_id`,
 * for one. A copy kept locally would go stale the first time somebody edited
 * their profile.
 */
export const PLATFORM_API =
  process.env['NEXT_PUBLIC_PLATFORM_API_URL'] ?? 'http://localhost:8080';

export class PlatformError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'PlatformError';
  }
}

/** Carries the hub's JWT, which arrives by postMessage rather than a cookie. */
export async function authorizedFetch<T>(url: string, options?: RequestInit): Promise<T> {
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
    throw new PlatformError(response.status, `Request failed with ${String(response.status)}`);
  }

  return (await response.json()) as T;
}

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
}

/** Who is signed in. Needs no admin role — it answers only about the caller. */
export async function getCurrentUser(): Promise<CurrentUser> {
  const result = await authorizedFetch<{ user: CurrentUser }>(`${PLATFORM_API}/auth/me`);
  return result.user;
}
