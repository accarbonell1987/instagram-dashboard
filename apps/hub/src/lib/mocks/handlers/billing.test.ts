/**
 * Billing handlers test.
 * Uses the global MSW Node server started in vitest.setup.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { seedDb } from '../seed';

const BASE = 'http://localhost:8080';

describe('billing handlers', () => {
  beforeEach(() => {
    seedDb('happy');
  });

  it('GET /billing/documents/:id/signed-url returns URL with future expiresAt', async () => {
    const documentId = 'doc-00000001-0000-0000-0000-000000000001';
    const response = await fetch(`${BASE}/billing/documents/${documentId}/signed-url`);
    expect(response.status).toBe(200);
    const body = await response.json() as { url: string; expiresAt: string };
    expect(typeof body.url).toBe('string');
    expect(typeof body.expiresAt).toBe('string');
    const expiresAt = new Date(body.expiresAt).getTime();
    expect(isNaN(expiresAt)).toBe(false);
  });

  it('GET /billing/documents/not-found/signed-url returns 404', async () => {
    const response = await fetch(`${BASE}/billing/documents/not-found/signed-url`);
    expect(response.status).toBe(404);
  });

  // ─── GET /billing/payment-method ─────────────────────────────────────────────

  it('GET /billing/payment-method returns payment method in happy scenario', async () => {
    const response = await fetch(`${BASE}/billing/payment-method`);
    expect(response.status).toBe(200);
    const body = await response.json() as { paymentMethod: { brand: string; lastFour: string } | null };
    expect(body.paymentMethod).not.toBeNull();
    expect(body.paymentMethod?.brand).toBe('visa');
    expect(body.paymentMethod?.lastFour).toBe('4242');
  });

  it('GET /billing/payment-method returns null in billing-empty scenario', async () => {
    seedDb('billing-empty');
    const response = await fetch(`${BASE}/billing/payment-method`);
    expect(response.status).toBe(200);
    const body = await response.json() as { paymentMethod: null };
    expect(body.paymentMethod).toBeNull();
  });

  // ─── POST /billing/payment-method ────────────────────────────────────────────

  it('POST /billing/payment-method returns 202 with id on success', async () => {
    const response = await fetch(`${BASE}/billing/payment-method`, { method: 'POST' });
    expect(response.status).toBe(202);
    const body = await response.json() as { id: string };
    expect(typeof body.id).toBe('string');
    expect(body.id.length).toBeGreaterThan(0);
  });

  it('POST /billing/payment-method returns 409 when pending request already exists', async () => {
    // First request creates a pending record
    await fetch(`${BASE}/billing/payment-method`, { method: 'POST' });
    // Second request should conflict
    const response = await fetch(`${BASE}/billing/payment-method`, { method: 'POST' });
    expect(response.status).toBe(409);
    const body = await response.json() as { detail: string };
    expect(body.detail).toBe('payment_method_change.pending_exists');
  });

});
