import { http, HttpResponse } from 'msw';
import { describe, it, expect } from 'vitest';

import {
  getPaymentMethod,
  requestPaymentMethodChange,
} from './billing.service';

import { ConflictError, AuthError, ForbiddenError } from '@/lib/api/errors';
import { seedDb } from '@/lib/mocks/seed';
import { server } from '@/lib/mocks/server';


const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

// ─── getPaymentMethod ─────────────────────────────────────────────────────────

describe('getPaymentMethod', () => {
  it('returns paymentMethod object when a card is registered', async () => {
    seedDb('happy');
    const result = await getPaymentMethod();
    expect(result.paymentMethod).not.toBeNull();
    expect(result.paymentMethod?.brand).toBe('visa');
    expect(result.paymentMethod?.lastFour).toBe('4242');
  });

  it('returns { paymentMethod: null } in billing-empty scenario', async () => {
    seedDb('billing-empty');
    const result = await getPaymentMethod();
    expect(result.paymentMethod).toBeNull();
  });

  it('throws AuthError when server returns 401', async () => {
    server.use(
      http.get(`${BASE}/billing/payment-method`, () =>
        HttpResponse.json({ type: 'about:blank', title: 'Unauthorized', status: 401 }, { status: 401, headers: { 'Content-Type': 'application/problem+json' } })
      )
    );
    await expect(getPaymentMethod()).rejects.toBeInstanceOf(AuthError);
  });

  it('throws ForbiddenError when server returns 403', async () => {
    server.use(
      http.get(`${BASE}/billing/payment-method`, () =>
        HttpResponse.json({ type: 'about:blank', title: 'Forbidden', status: 403 }, { status: 403, headers: { 'Content-Type': 'application/problem+json' } })
      )
    );
    await expect(getPaymentMethod()).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// ─── requestPaymentMethodChange ──────────────────────────────────────────────

describe('requestPaymentMethodChange', () => {
  it('returns { id: string } on 202 success', async () => {
    seedDb('happy');
    const result = await requestPaymentMethodChange();
    expect(typeof result.id).toBe('string');
    expect(result.id.length).toBeGreaterThan(0);
  });

  it('throws ConflictError when a pending request already exists (409)', async () => {
    seedDb('happy');
    // First request succeeds
    await requestPaymentMethodChange();
    // Second should conflict
    await expect(requestPaymentMethodChange()).rejects.toBeInstanceOf(ConflictError);
  });

  it('sends Idempotency-Key header', async () => {
    let capturedKey: string | null = null;
    server.use(
      http.post(`${BASE}/billing/payment-method`, ({ request }) => {
        capturedKey = request.headers.get('Idempotency-Key');
        return HttpResponse.json({ id: 'test-id' }, { status: 202 });
      })
    );
    await requestPaymentMethodChange();
    expect(capturedKey).toBeTruthy();
  });

  it('throws ForbiddenError when server returns 403', async () => {
    server.use(
      http.post(`${BASE}/billing/payment-method`, () =>
        HttpResponse.json({ type: 'about:blank', title: 'Forbidden', status: 403 }, { status: 403, headers: { 'Content-Type': 'application/problem+json' } })
      )
    );
    await expect(requestPaymentMethodChange()).rejects.toBeInstanceOf(ForbiddenError);
  });
});
