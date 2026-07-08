import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { AppEnv } from './env';

/**
 * loadEnv() lee de import.meta.env, que es global en Vite.
 * Para testearlo necesitamos mockear import.meta.env antes de cada test
 * y re-importar el módulo para que lea los valores frescos.
 */

const VALID_ENV = {
  VITE_API_URL: 'https://api.test.com',
  VITE_AUTH_URL: 'https://auth.test.com',
  VITE_CLIENT_ID: 'test-id',
  VITE_CLIENT_SECRET: 'test-secret',
  VITE_VERSION_V1: '/api/v1',
  VITE_VERSION_V2: '/api/v2',
  VITE_VERSION_V3: '/api/v3',
};

function setEnv(overrides: Record<string, string | undefined> = {}) {
  const env = { ...VALID_ENV, ...overrides };
  vi.stubGlobal('import', { meta: { env: env } });
  // Vitest con jsdom expone import.meta.env directamente
  Object.assign(import.meta.env, env);
}

function clearEnv() {
  // Limpiar todas las VITE_ keys
  for (const key of Object.keys(VALID_ENV)) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (import.meta.env as Record<string, unknown>)[key];
  }
}

describe('loadEnv', () => {
  beforeEach(() => {
    clearEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearEnv();
  });

  it('returns all env variables when all are present', async () => {
    setEnv();
    // Re-import para que lea el env fresco
    const { loadEnv } = await import('./env');

    const result: AppEnv = loadEnv();

    expect(result).toEqual({
      apiUrl: 'https://api.test.com',
      authUrl: 'https://auth.test.com',
      clientId: 'test-id',
      clientSecret: 'test-secret',
      versionV1: '/api/v1',
      versionV2: '/api/v2',
      versionV3: '/api/v3',
    });
  });

  it('throws when VITE_API_URL is missing', async () => {
    setEnv({ VITE_API_URL: undefined });
    delete (import.meta.env as Record<string, unknown>)['VITE_API_URL'];
    const { loadEnv } = await import('./env');

    expect(() => loadEnv()).toThrow('Missing required environment variables: VITE_API_URL');
  });

  it('throws when VITE_AUTH_URL is missing', async () => {
    setEnv({ VITE_AUTH_URL: undefined });
    delete (import.meta.env as Record<string, unknown>)['VITE_AUTH_URL'];
    const { loadEnv } = await import('./env');

    expect(() => loadEnv()).toThrow('VITE_AUTH_URL');
  });

  it('throws when VITE_CLIENT_ID is missing', async () => {
    setEnv({ VITE_CLIENT_ID: undefined });
    delete (import.meta.env as Record<string, unknown>)['VITE_CLIENT_ID'];
    const { loadEnv } = await import('./env');

    expect(() => loadEnv()).toThrow('VITE_CLIENT_ID');
  });

  it('throws when VITE_CLIENT_SECRET is missing', async () => {
    setEnv({ VITE_CLIENT_SECRET: undefined });
    delete (import.meta.env as Record<string, unknown>)['VITE_CLIENT_SECRET'];
    const { loadEnv } = await import('./env');

    expect(() => loadEnv()).toThrow('VITE_CLIENT_SECRET');
  });

  it('lists all missing variables in the error message', async () => {
    clearEnv();
    const { loadEnv } = await import('./env');

    expect(() => loadEnv()).toThrow(
      'Missing required environment variables: VITE_API_URL, VITE_AUTH_URL, VITE_CLIENT_ID, VITE_CLIENT_SECRET'
    );
  });

  it('uses default version paths when not provided', async () => {
    setEnv({
      VITE_VERSION_V1: undefined,
      VITE_VERSION_V2: undefined,
      VITE_VERSION_V3: undefined,
    });
    delete (import.meta.env as Record<string, unknown>)['VITE_VERSION_V1'];
    delete (import.meta.env as Record<string, unknown>)['VITE_VERSION_V2'];
    delete (import.meta.env as Record<string, unknown>)['VITE_VERSION_V3'];
    const { loadEnv } = await import('./env');

    const result = loadEnv();

    expect(result.versionV1).toBe('/api/v1');
    expect(result.versionV2).toBe('/api/v2');
    expect(result.versionV3).toBe('/api/v3');
  });
});
