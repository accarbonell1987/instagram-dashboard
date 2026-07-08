import type { AuthStrategy, ITokenProvider, TokenResponse } from '@core/core/auth';
import { createServicesStore } from '@core/core/react';
import { createCoreServices } from '@core/core/services';
import { isAxiosError } from 'axios';

import { refreshSession } from '../modules/iam/identity/session/refresh';
import {
  getAccessToken,
  isExpired,
  clearAccessToken,
} from '../modules/iam/identity/session/token';

// ─── ITokenProvider bridge ──────────────────────────────
// Bridges the module-level tokenHolder (in-memory, XSS-resistant) to the
// ITokenProvider interface that createCoreServices expects.
//
// P3 wiring: refreshToken() now delegates to refreshSession() (single-flight,
// from the identity module). This means Axios entity services (Plans, etc.)
// will trigger the same single-flight refresh as the fetch layer — no double
// refresh races.
const tokenProviderBridge: ITokenProvider = {
  getAccessToken(): Promise<string | null> {
    const token = getAccessToken();
    if (token === null || isExpired(token)) return Promise.resolve(null);
    return Promise.resolve(token.raw);
  },
  async refreshToken(): Promise<string | null> {
    try {
      await refreshSession();
      const refreshed = getAccessToken();
      return refreshed?.raw ?? null;
    } catch {
      return null;
    }
  },
  isExpired(): boolean {
    return isExpired(getAccessToken());
  },
  clear(): void {
    clearAccessToken();
  },
};

// ─── Noop AuthStrategy ──────────────────────────────────
// Hub does NOT use AuthStrategy for token lifecycle — it uses the fetch-layer
// tokenHolder + httpOnly cookie refresh. This noop satisfies the interface so
// createCoreServices can build the Token + Axios infrastructure.
const noopAuthStrategy: AuthStrategy = {
  requestToken: (): Promise<TokenResponse> =>
    Promise.resolve({ accessToken: '', refreshToken: '', expiresIn: 0 }),
  refreshToken: (): Promise<TokenResponse> =>
    Promise.resolve({ accessToken: '', refreshToken: '', expiresIn: 0 }),
};

// ─── Core services ──────────────────────────────────────
// Used ONLY for its createService() factory to build entity services (Plans,
// Onboarding draft) with CrudService + ServiceExtender. Auth operations use
// the separate fetch wrapper (lib/api/client.ts) directly.
//
// Note: createCoreServices builds an Axios instance with its own auth
// interceptor. That interceptor reads from the Token instance built internally
// from noopAuthStrategy, not from our bridge. The workaround for Axios entity
// services to send Bearer tokens is:
// 1. After login, call tokenProviderBridge.getAccessToken() to verify the
//    bridge reads the tokenHolder correctly.
// 2. For entity services (CrudService), add a custom Axios request interceptor
//    to coreServices.httpClient that injects the Bearer token from tokenHolder.
//    This is wired here via the request interceptor below.

export const coreServices = createCoreServices({
  auth: { type: 'custom', strategy: noopAuthStrategy },
  baseUrl: process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080',
});

// ─── Axios Bearer injection (Phase 3) ──────────────────
// Add a custom Axios request interceptor to inject the Bearer token from
// tokenHolder into all entity service requests. This replaces the noop
// authStrategy for Axios calls without requiring post-construction mutation
// of createCoreServices internals.
coreServices.httpClient.interceptors.request.use(async (config) => {
  const raw = await tokenProviderBridge.getAccessToken();
  if (raw !== null) {
    config.headers.set('Authorization', `Bearer ${raw}`);
  }
  return config;
});

// ─── Spring RFC 7807 error normalizer ──────────────────

interface SpringProblemBody {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  errors?: unknown[];
}

function normalizeSpringError(error: unknown): never {
  if (isAxiosError<SpringProblemBody>(error) && error.response?.data) {
    const body = error.response.data;
    if (typeof body.code === 'string') error.code = body.code;
    const message = body.detail ?? body.title;
    if (typeof message === 'string') error.message = message;
  }
  throw error;
}

// Axios processes response interceptors FIFO. To run normalizeSpringError
// BEFORE the errorInterceptor already registered inside createCoreServices,
// we insert it at position 0 in the internal handlers array.
(
  coreServices.httpClient.interceptors.response as unknown as {
    handlers: ({ fulfilled: unknown; rejected: unknown } | null)[];
  }
).handlers.unshift({
  fulfilled: (response: unknown) => response,
  rejected: normalizeSpringError,
});

// ─── Zustand store + hooks ──────────────────────────────

export const { store, useServices, useServicesStore } = createServicesStore();

export { tokenProviderBridge };
