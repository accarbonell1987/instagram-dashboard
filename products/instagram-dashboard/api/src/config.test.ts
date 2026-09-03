import { describe, it, expect, vi, beforeAll } from 'vitest';

import type { Config } from './config.js';

// Mock dotenv BEFORE any import of config.ts to prevent .env file from loading
vi.mock('dotenv', () => ({
  config: vi.fn(() => ({ parsed: {} })),
}));

describe('ConfigSchema — ENABLE_USAGE_TRACKING', () => {
  const baseEnv = {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    IAM_JWKS_URL: 'http://localhost:8080',
    IG_APP_ID: 'test_app_id',
    IG_APP_SECRET: 'test_secret',
    IG_REDIRECT_URI: 'http://localhost:3003/callback',
    ENCRYPTION_KEY: 'a'.repeat(64),
    DEEPSEEK_API_KEY: 'test_key',
  };

  // We test the schema directly to isolate the ENABLE_USAGE_TRACKING field
  // Import the ConfigSchema dynamically after mocking dotenv
  let ConfigSchema: { parse: (input: unknown) => Config };

  beforeAll(async () => {
    const mod = await import('./config.js');
    ConfigSchema = mod.ConfigSchema;
  });

  it('defaults to true when ENABLE_USAGE_TRACKING is not set', () => {
    const result = ConfigSchema.parse({ ...baseEnv });
    expect(result.ENABLE_USAGE_TRACKING).toBe(true);
  });

  it('parses "true" string as boolean true', () => {
    const result = ConfigSchema.parse({
      ...baseEnv,
      ENABLE_USAGE_TRACKING: 'true',
    });
    expect(result.ENABLE_USAGE_TRACKING).toBe(true);
  });

  it('parses "false" string as boolean false', () => {
    const result = ConfigSchema.parse({
      ...baseEnv,
      ENABLE_USAGE_TRACKING: 'false',
    });
    expect(result.ENABLE_USAGE_TRACKING).toBe(false);
  });

  it('parses "1" as boolean true', () => {
    const result = ConfigSchema.parse({
      ...baseEnv,
      ENABLE_USAGE_TRACKING: '1',
    });
    expect(result.ENABLE_USAGE_TRACKING).toBe(true);
  });

  it('parses "0" as boolean false', () => {
    const result = ConfigSchema.parse({
      ...baseEnv,
      ENABLE_USAGE_TRACKING: '0',
    });
    expect(result.ENABLE_USAGE_TRACKING).toBe(false);
  });
});

describe('ConfigSchema — guarda de localhost en production', () => {
  // Lo minimo que la config exige; el resto cae en defaults.
  const baseEnv = {
    DATABASE_URL: 'postgresql://u:p@postgres:5432/db',
    IAM_JWKS_URL: 'http://api-iam:8080',
    IG_APP_ID: 'app-id',
    IG_APP_SECRET: 'app-secret',
    IG_REDIRECT_URI: 'https://iga.example.com/api/auth/instagram/callback',
    ENCRYPTION_KEY: 'a'.repeat(64),
    DEEPSEEK_API_KEY: 'key',
  };

  let ConfigSchema: { safeParse: (input: unknown) => { success: boolean; error?: { issues: { path: (string | number)[] }[] } } };

  beforeAll(async () => {
    const mod = await import('./config.js');
    ConfigSchema = mod.ConfigSchema as unknown as typeof ConfigSchema;
  });

  // POST_AUTH_REDIRECT_URL cae a http://localhost:3001 si nadie la setea. Eso
  // mando el callback de OAuth de Instagram a la maquina del usuario en vez del
  // servidor: la pantalla quedaba en blanco hasta recargar a mano.
  it('rechaza un default de desarrollo que llego a production', () => {
    const result = ConfigSchema.safeParse({ ...baseEnv, NODE_ENV: 'production' });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === 'POST_AUTH_REDIRECT_URL')).toBe(true);
  });

  it('acepta production cuando las URLs son alcanzables', () => {
    const result = ConfigSchema.safeParse({
      ...baseEnv,
      NODE_ENV: 'production',
      POST_AUTH_REDIRECT_URL: 'https://corehub.example.com',
      IAM_INTERNAL_URL: 'http://api-iam:8080',
    });

    expect(result.success).toBe(true);
  });

  // Los defaults existen para que `pnpm dev` arranque sin un .env completo.
  it('en desarrollo deja pasar los defaults de localhost', () => {
    const result = ConfigSchema.safeParse(baseEnv);

    expect(result.success).toBe(true);
  });

  // Las demas URLs van explicitas y sanas: si quedaran en su default de
  // localhost, la config fallaria por ELLAS y este test pasaria sin probar nada.
  it('tambien atrapa 127.0.0.1, no solo la palabra localhost', () => {
    const result = ConfigSchema.safeParse({
      ...baseEnv,
      NODE_ENV: 'production',
      IAM_INTERNAL_URL: 'http://api-iam:8080',
      POST_AUTH_REDIRECT_URL: 'http://127.0.0.1:3001',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0])).toEqual(['POST_AUTH_REDIRECT_URL']);
  });
});
