/**
 * Plans handlers test.
 * Uses the global MSW Node server started in vitest.setup.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { seedDb } from '../seed';

const BASE = 'http://localhost:8080';

describe('plans handlers', () => {
  beforeEach(() => {
    seedDb('happy');
  });

  it('GET /plans returns 3 plans in { plans } envelope', async () => {
    const response = await fetch(`${BASE}/plans`);
    expect(response.status).toBe(200);
    const body = await response.json() as { plans: unknown[] };
    expect(Array.isArray(body.plans)).toBe(true);
    expect(body.plans).toHaveLength(3);
  });

  it('GET /plans/:planId returns the plan', async () => {
    const response = await fetch(`${BASE}/plans/professional`);
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body['id']).toBe('professional');
    expect(body['popular']).toBe(true);
  });

  it('GET /plans/:planId with unknown ID returns 404', async () => {
    const response = await fetch(`${BASE}/plans/nonexistent-plan-id`);
    expect(response.status).toBe(404);
  });
});
