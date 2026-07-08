import type { AuthStrategy, TokenResponse } from '@core/core/auth';
import { createServicesStore } from '@core/core/react';
import { createCoreServices } from '@core/core/services';

// ─── Auth strategy ─────────────────────────────────────

/**
 * Noop auth strategy for unauthenticated API access.
 *
 * The api-example currently doesn't require authentication,
 * so we use a simple pass-through strategy.
 * Replace with OAuth/API auth when implementing real authentication.
 */
const noopAuthStrategy: AuthStrategy = {
  requestToken: (): Promise<TokenResponse> =>
    Promise.resolve({
      accessToken: '',
      refreshToken: '',
      expiresIn: 0,
    }),
  refreshToken: (): Promise<TokenResponse> =>
    Promise.resolve({
      accessToken: '',
      refreshToken: '',
      expiresIn: 0,
    }),
};

// ─── Core services ─────────────────────────────────────

/**
 * Core services configured to connect to api-example.
 *
 * In development, the API runs on localhost:3005.
 * In production, this should be configured via environment variables.
 */
const coreServices = createCoreServices({
  auth: { type: 'custom', strategy: noopAuthStrategy },
  baseUrl: process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3005/api',
});

// ─── Zustand store + hooks ─────────────────────────────

export const { store, useServices, useServicesStore } = createServicesStore();

export { coreServices };
