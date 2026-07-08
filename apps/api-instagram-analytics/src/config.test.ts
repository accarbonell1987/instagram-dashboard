import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
  let ConfigSchema: typeof import('./config').ConfigSchema;

  beforeAll(async () => {
    const mod = await import('./config');
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
