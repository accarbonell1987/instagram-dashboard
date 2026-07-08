import { test, expect } from '@playwright/test';

/**
 * Integration tests — Plans API contract compliance.
 *
 * Verifies that GET /plans returns contract-compliant data:
 *   - `billingCycle` field (not `billingInterval`)
 *   - `features` is an array of strings (not an object/record)
 *
 * These tests call the api-iam directly (bypassing the hub frontend)
 * to validate the backend response shape matches contract v1.1.1.
 *
 * Pre-requisites:
 *   - api-iam running on :8080
 *   - DB seeded: pnpm --filter @corehub/api-iam db:seed-test
 *
 * Note: api-iam returns responses WITHOUT an envelope ({ success, data }).
 * GET /plans returns: { plans: Plan[] }
 */
test.describe('Plans API — contract compliance', () => {
  const API_URL = 'http://localhost:8080';

  test('GET /plans returns 200 with plans array', async ({ request }) => {
    const response = await request.get(`${API_URL}/plans`);
    expect(response.status()).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    // api-iam returns { plans: [...] } directly (no envelope)
    const plans = body['plans'] as unknown[];
    expect(Array.isArray(plans)).toBe(true);
    expect(plans.length).toBeGreaterThan(0);
  });

  test('plans have billingCycle (not billingInterval)', async ({ request }) => {
    const response = await request.get(`${API_URL}/plans`);
    expect(response.status()).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    const plans = body['plans'] as unknown[];

    for (const plan of plans) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = plan as any;
      expect(p).toHaveProperty('billingCycle');
      expect(p).not.toHaveProperty('billingInterval');
      expect(['monthly', 'yearly']).toContain(p.billingCycle as string);
    }
  });

  test('plans have features as array of strings', async ({ request }) => {
    const response = await request.get(`${API_URL}/plans`);
    expect(response.status()).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    const plans = body['plans'] as unknown[];

    for (const plan of plans) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = plan as any;
      expect(Array.isArray(p.features)).toBe(true);
      for (const feature of p.features as unknown[]) {
        expect(typeof feature).toBe('string');
      }
    }
  });

  test('plans have required contract fields: id, name, price, currency', async ({ request }) => {
    const response = await request.get(`${API_URL}/plans`);
    expect(response.status()).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    const plans = body['plans'] as unknown[];

    for (const plan of plans) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = plan as any;
      expect(typeof p.id).toBe('string');
      expect(typeof p.name).toBe('string');
      expect(typeof p.price).toBe('number');
      expect(typeof p.currency).toBe('string');
    }
  });
});
