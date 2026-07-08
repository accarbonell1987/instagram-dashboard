import { describe, it, expect } from 'vitest';

import { seedDb, SEED } from '@/lib/mocks/seed';
import { ConflictError, AuthError, ForbiddenError } from '@/lib/api/errors';
import { server } from '@/lib/mocks/server';
import { http, HttpResponse } from 'msw';

import {
  getPaymentMethod,
  requestPaymentMethodChange,
  listInvoices,
  getInvoiceSignedUrl,
} from './billing.service';

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

// ─── listInvoices ─────────────────────────────────────────────────────────────

describe('listInvoices', () => {
  it('returns items, total, page, pageSize for default params', async () => {
    seedDb('happy');
    const result = await listInvoices();
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
    expect(typeof result.total).toBe('number');
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });

  it('respects page and pageSize query params', async () => {
    seedDb('happy');
    const result = await listInvoices({ page: 1, pageSize: 2 });
    expect(result.items.length).toBeLessThanOrEqual(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(2);
  });

  it('returns empty items array in billing-empty scenario', async () => {
    seedDb('billing-empty');
    const result = await listInvoices();
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/billing/invoices`, () =>
        HttpResponse.json({ type: 'about:blank', title: 'Unauthorized', status: 401 }, { status: 401, headers: { 'Content-Type': 'application/problem+json' } })
      )
    );
    await expect(listInvoices()).rejects.toBeInstanceOf(AuthError);
  });
});

// ─── getInvoiceSignedUrl ──────────────────────────────────────────────────────

describe('getInvoiceSignedUrl', () => {
  it('returns url and expiresAt for a valid invoiceId with a documentId', async () => {
    seedDb('happy');
    const invoiceId = SEED.invoiceIds[0]; // paid invoice with documentId
    const result = await getInvoiceSignedUrl(invoiceId);
    expect(typeof result.url).toBe('string');
    expect(typeof result.expiresAt).toBe('string');
  });

  it('throws ApiError with status 404 for a non-existent invoiceId', async () => {
    seedDb('happy');
    await expect(getInvoiceSignedUrl('non-existent-id')).rejects.toThrow();
  });

  it('throws ApiError with status 404 for an invoiceId whose documentId is null', async () => {
    seedDb('happy');
    const invoiceId = SEED.invoiceIds[2]; // pending invoice, no documentId
    await expect(getInvoiceSignedUrl(invoiceId)).rejects.toThrow();
  });
});
