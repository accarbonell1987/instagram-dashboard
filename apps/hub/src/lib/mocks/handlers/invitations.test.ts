/**
 * Invitations handlers test.
 * Uses the global MSW Node server started in vitest.setup.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { seedDb, applyScenario } from '../seed';

const BASE = 'http://localhost:8080';

describe('invitations handlers', () => {
  beforeEach(() => {
    seedDb('happy');
  });

  it('GET /invitations/:token happy returns invitation preview', async () => {
    const response = await fetch(`${BASE}/invitations/some-token`);
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body['status']).toBe('pending');
    expect(typeof body['email']).toBe('string');
  });

  it('GET /invitations/:token with invitation-expired scenario returns 410', async () => {
    applyScenario('invitation-expired');
    const response = await fetch(`${BASE}/invitations/some-token`);
    expect(response.status).toBe(410);
    const contentType = response.headers.get('content-type') ?? '';
    expect(contentType).toContain('application/problem+json');
  });

  it('POST /invitations/:token/accept with invitation-expired scenario returns 410', async () => {
    applyScenario('invitation-expired');
    const response = await fetch(`${BASE}/invitations/some-token/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': '550e8400-inv-0000-0000-000000000020',
      },
      body: JSON.stringify({ password: 'NewPass1234!' }),
    });
    expect(response.status).toBe(410);
  });

  it('POST /invitations/:token/accept happy returns session', async () => {
    const response = await fetch(`${BASE}/invitations/some-token/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': '550e8400-inv-0000-0000-000000000021',
      },
      body: JSON.stringify({ password: 'NewPass1234!' }),
    });
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(typeof body['accessToken']).toBe('string');
  });
});
