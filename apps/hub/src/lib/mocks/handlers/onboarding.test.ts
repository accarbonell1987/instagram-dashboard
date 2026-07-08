/**
 * Onboarding handlers test.
 * Uses the global MSW Node server started in vitest.setup.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { seedDb, applyScenario } from '../seed';

const BASE = 'http://localhost:8080';

describe('onboarding handlers', () => {
  beforeEach(() => {
    seedDb('happy');
  });

  it('POST /onboarding/draft creates a draft and returns 201', async () => {
    const idemKey = '550e8400-onb-0000-0000-000000000010';
    const response = await fetch(`${BASE}/onboarding/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idemKey,
      },
      body: JSON.stringify({ planId: 'professional' }),
    });
    expect(response.status).toBe(201);
    const body = await response.json() as Record<string, unknown>;
    expect(typeof body['id']).toBe('string');
    expect(body['currentStep']).toBe('representative');
    expect(body['status']).toBe('draft');
    expect(typeof body['version']).toBe('number');
  });

  it('POST /onboarding/draft without planId starts at plan step', async () => {
    const response = await fetch(`${BASE}/onboarding/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': '550e8400-onb-0000-0000-000000000011',
      },
      body: JSON.stringify({}),
    });
    const body = await response.json() as Record<string, unknown>;
    expect(body['currentStep']).toBe('plan');
  });

  it('idempotency: same Idempotency-Key returns same draft id', async () => {
    const idemKey = '550e8400-onb-0000-0000-000000000012';
    const firstResponse = await fetch(`${BASE}/onboarding/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idemKey,
      },
      body: JSON.stringify({ planId: 'starter' }),
    });
    const firstBody = await firstResponse.json() as Record<string, unknown>;

    const secondResponse = await fetch(`${BASE}/onboarding/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idemKey,
      },
      body: JSON.stringify({ planId: 'starter' }),
    });
    const secondBody = await secondResponse.json() as Record<string, unknown>;

    expect(firstBody['id']).toBe(secondBody['id']);
  });

  it('GET /onboarding/draft/:id returns draft state', async () => {
    const createResponse = await fetch(`${BASE}/onboarding/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': '550e8400-onb-0000-0000-000000000013',
      },
      body: JSON.stringify({ planId: 'professional' }),
    });
    const { id } = await createResponse.json() as { id: string };

    const response = await fetch(`${BASE}/onboarding/draft/${id}`);
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body['id']).toBe(id);
  });

  it('GET /onboarding/draft/:id with unknown ID returns 404', async () => {
    const response = await fetch(`${BASE}/onboarding/draft/nonexistent-draft-id-xyz`);
    expect(response.status).toBe(404);
  });

  it('payment status in happy scenario progresses from pending to approved', async () => {
    // Create draft
    const draftResponse = await fetch(`${BASE}/onboarding/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': '550e8400-onb-0000-0000-000000000014',
      },
      body: JSON.stringify({ planId: 'professional' }),
    });
    const { id: draftId } = await draftResponse.json() as { id: string };

    // Initiate payment
    await fetch(`${BASE}/onboarding/draft/${draftId}/payment/initiate`, {
      method: 'POST',
      headers: { 'Idempotency-Key': '550e8400-onb-0000-0000-000000000015' },
    });

    // First poll: pending
    const poll1 = await fetch(`${BASE}/onboarding/draft/${draftId}/payment/status`);
    const { status: s1 } = await poll1.json() as { status: string };
    expect(s1).toBe('pending');

    // Second poll: pending
    const poll2 = await fetch(`${BASE}/onboarding/draft/${draftId}/payment/status`);
    const { status: s2 } = await poll2.json() as { status: string };
    expect(s2).toBe('pending');

    // Third poll: approved
    const poll3 = await fetch(`${BASE}/onboarding/draft/${draftId}/payment/status`);
    const { status: s3 } = await poll3.json() as { status: string };
    expect(s3).toBe('approved');
  });

  it('payment status in payment-cancelled scenario returns declined', async () => {
    applyScenario('payment-cancelled');
    const draftResponse = await fetch(`${BASE}/onboarding/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': '550e8400-onb-0000-0000-000000000016',
      },
      body: JSON.stringify({ planId: 'starter' }),
    });
    const { id: draftId } = await draftResponse.json() as { id: string };

    // Initiate payment
    await fetch(`${BASE}/onboarding/draft/${draftId}/payment/initiate`, {
      method: 'POST',
      headers: { 'Idempotency-Key': '550e8400-onb-0000-0000-000000000017' },
    });

    const poll = await fetch(`${BASE}/onboarding/draft/${draftId}/payment/status`);
    const { status } = await poll.json() as { status: string };
    expect(status).toBe('declined');
  });
});
