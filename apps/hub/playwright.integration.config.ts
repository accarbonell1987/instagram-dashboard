import { defineConfig, devices } from '@playwright/test';

/**
 * Integration Playwright config — runs Hub against REAL api-iam (no MSW).
 *
 * Starts two web servers:
 *   1. api-iam on :8080  (health gate: GET /healthz)
 *   2. hub    on :3001  (MSW disabled via NEXT_PUBLIC_API_URL override)
 *
 * Usage:
 *   pnpm --filter @corehub/hub test:e2e:integration
 *
 * Pre-requisites:
 *   - PostgreSQL running (docker compose up -d in apps/api-iam)
 *   - DB seeded: pnpm --filter @corehub/api-iam db:seed-test
 */
export default defineConfig({
  testDir: './e2e/integration',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: process.env['CI'] ? 'github' : 'html',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    storageState: undefined,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      // api-iam: starts on :8080, health-checked at /healthz
      command: 'pnpm --filter @corehub/api-iam dev',
      url: 'http://localhost:8080/healthz',
      reuseExistingServer: !process.env['CI'],
      timeout: 60_000,
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
        ),
        OTP_STUB_CODE: '000000',
      },
    },
    {
      // hub: MSW disabled — points at real api-iam
      command: 'pnpm --filter @corehub/hub dev',
      url: 'http://localhost:3001',
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_API_URL: 'http://localhost:8080',
        NEXT_PUBLIC_API_MOCKING: 'disabled',
      },
    },
  ],
});
