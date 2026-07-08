/**
 * Identity handlers test.
 * Uses the global MSW Node server started in vitest.setup.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { seedDb } from '../seed';

const BASE = 'http://localhost:8080';

describe('identity handlers', () => {
  beforeEach(() => {
    seedDb('happy');
  });

  it('GET /tenants/current returns tenant info', async () => {
    const response = await fetch(`${BASE}/tenants/current`);
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body['slug']).toBe('acme');
    expect(body['status']).toBe('active');
  });
});
