import { afterEach, vi } from 'vitest';

// Test environment variables for config.ts validation
process.env['DATABASE_URL'] = 'postgresql://postgres:postgres@localhost:5432/corehub_test';
process.env['IAM_JWKS_URL'] = 'http://localhost:8080';
process.env['IG_APP_ID'] = 'test_app_id';
process.env['IG_APP_SECRET'] = 'test_app_secret';
process.env['IG_REDIRECT_URI'] = 'http://localhost:3003/api/auth/instagram/callback';
process.env['ENCRYPTION_KEY'] = 'a'.repeat(64); // 64 hex chars
process.env['NODE_ENV'] = 'test';
process.env['DEEPSEEK_API_KEY'] = 'test_deepseek_api_key';

afterEach(() => {
  vi.clearAllMocks();
});
