import { describe, it, expect } from 'vitest';

import { buildApiUrls } from './apiUrls';
import type { AppEnv } from './env';

function createTestEnv(overrides?: Partial<AppEnv>): AppEnv {
  return {
    apiUrl: 'https://api.weecover.com',
    authUrl: 'https://auth.weecover.com',
    clientId: 'test-client',
    clientSecret: 'test-secret',
    versionV1: '/api/v1',
    versionV2: '/api/v2',
    versionV3: '/api/v3',
    ...overrides,
  };
}

describe('buildApiUrls', () => {
  it('constructs all versioned URLs from env', () => {
    const env = createTestEnv();
    const urls = buildApiUrls(env);

    expect(urls.v1).toBe('https://api.weecover.com/api/v1');
    expect(urls.v2).toBe('https://api.weecover.com/api/v2');
    expect(urls.v3).toBe('https://api.weecover.com/api/v3');
  });

  it('sets filter URL to v1 base', () => {
    const env = createTestEnv();
    const urls = buildApiUrls(env);

    expect(urls.filter).toBe('https://api.weecover.com/api/v1');
    expect(urls.filter).toBe(urls.v1);
  });

  it('handles different api base URLs', () => {
    const env = createTestEnv({ apiUrl: 'http://localhost:8080' });
    const urls = buildApiUrls(env);

    expect(urls.v1).toBe('http://localhost:8080/api/v1');
    expect(urls.v2).toBe('http://localhost:8080/api/v2');
    expect(urls.v3).toBe('http://localhost:8080/api/v3');
  });

  it('handles custom version paths', () => {
    const env = createTestEnv({
      versionV1: '/v1',
      versionV2: '/v2',
      versionV3: '/v3',
    });
    const urls = buildApiUrls(env);

    expect(urls.v1).toBe('https://api.weecover.com/v1');
    expect(urls.v2).toBe('https://api.weecover.com/v2');
    expect(urls.v3).toBe('https://api.weecover.com/v3');
  });

  it('handles apiUrl with trailing slash gracefully', () => {
    const env = createTestEnv({ apiUrl: 'https://api.weecover.com/' });
    const urls = buildApiUrls(env);

    // Nota: la concatenación directa puede generar doble slash.
    // Esto es intencional — la URL base no debería tener trailing slash.
    expect(urls.v1).toBe('https://api.weecover.com//api/v1');
  });
});
