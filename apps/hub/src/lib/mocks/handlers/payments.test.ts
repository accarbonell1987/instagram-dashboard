// @vitest-environment node
/**
 * Payments handlers test (bank-transfer-payments slice 1 — contract).
 * Uses the global MSW Node server started in vitest.setup.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { seedDb, SEED } from '../seed';

const BASE = 'http://localhost:8080';

describe('payments handlers', () => {
  beforeEach(() => {
    seedDb('happy');
  });

  it('GET /admin/payments returns the seeded queue', async () => {
    const response = await fetch(`${BASE}/admin/payments`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: unknown[]; total: number };
    expect(body.total).toBe(3);
    expect(body.items).toHaveLength(3);
  });

  it('GET /admin/payments filters by status', async () => {
    const response = await fetch(`${BASE}/admin/payments?status=pending`);
    const body = (await response.json()) as { items: { status: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.status).toBe('pending');
  });

  it('POST /admin/payments/:id/confirm rejects an empty note', async () => {
    const response = await fetch(`${BASE}/admin/payments/${SEED.paymentIds[1]}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: '' }),
    });
    expect(response.status).toBe(422);
  });

  it('POST /admin/payments/:id/confirm settles a pending payment', async () => {
    const response = await fetch(`${BASE}/admin/payments/${SEED.paymentIds[1]}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'Verified in bank statement' }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; settlementKind: string };
    expect(body.status).toBe('approved');
    expect(body.settlementKind).toBe('agent');
  });

  it('POST /admin/payments/:id/confirm is a no-op on an already-settled payment', async () => {
    const note = { note: 'Verified in bank statement' };
    await fetch(`${BASE}/admin/payments/${SEED.paymentIds[1]}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(note),
    });
    const response = await fetch(`${BASE}/admin/payments/${SEED.paymentIds[1]}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'Second confirm attempt' }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { note: string };
    expect(body.note).toBe('Verified in bank statement'); // untouched, not re-settled
  });

  it('POST /admin/payments/:id/confirm returns 404 for an unmatched id', async () => {
    const response = await fetch(`${BASE}/admin/payments/does-not-exist/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'x' }),
    });
    expect(response.status).toBe(404);
  });

  it('POST /admin/payments/:id/reject marks the payment declined', async () => {
    const response = await fetch(`${BASE}/admin/payments/${SEED.paymentIds[1]}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'Reference not found in statement' }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe('declined');
  });

  it('GET /admin/payment-methods returns bancard enabled, bank_transfer disabled', async () => {
    const response = await fetch(`${BASE}/admin/payment-methods`);
    const body = (await response.json()) as { items: { method: string; enabled: boolean }[] };
    const bancard = body.items.find((m) => m.method === 'bancard');
    const bankTransfer = body.items.find((m) => m.method === 'bank_transfer');
    expect(bancard?.enabled).toBe(true);
    expect(bankTransfer?.enabled).toBe(false);
  });

  it('PATCH /admin/payment-methods/:method rejects disabling the last enabled method', async () => {
    const response = await fetch(`${BASE}/admin/payment-methods/bancard`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    expect(response.status).toBe(409);
    const body = (await response.json()) as { detail: string };
    expect(body.detail).toBe('payment_method.last_enabled');
  });

  it('PATCH /admin/payment-methods/:method enables bank_transfer', async () => {
    const response = await fetch(`${BASE}/admin/payment-methods/bank_transfer`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { enabled: boolean };
    expect(body.enabled).toBe(true);
  });

  it('PATCH /admin/payment-methods/:method persists displayName and accounts', async () => {
    const account = { bankName: 'Banco Itaú', accountType: 'checking', accountNumber: '456', accountHolder: 'Corehub' };
    const response = await fetch(`${BASE}/admin/payment-methods/bank_transfer`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false, displayName: 'Transferencia', accounts: [account] }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { displayName: string; accounts: unknown[] };
    expect(body.displayName).toBe('Transferencia');
    expect(body.accounts).toEqual([account]);
  });

  it('PATCH /admin/payment-methods/:method leaves accounts untouched when omitted', async () => {
    const response = await fetch(`${BASE}/admin/payment-methods/bank_transfer`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    const body = (await response.json()) as { accounts: unknown[] };
    expect(body.accounts.length).toBeGreaterThan(0);
  });

  it('PATCH /admin/payment-methods/:method refuses enabling bank_transfer with no accounts', async () => {
    await fetch(`${BASE}/admin/payment-methods/bank_transfer`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false, accounts: [] }),
    });

    const response = await fetch(`${BASE}/admin/payment-methods/bank_transfer`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    expect(response.status).toBe(409);
    const body = (await response.json()) as { detail: string };
    expect(body.detail).toBe('payment_method.no_accounts_configured');
  });

  it('GET /billing/payments returns the tenant payment history', async () => {
    const response = await fetch(`${BASE}/billing/payments`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: { tenantId: string }[]; total: number };
    expect(body.total).toBe(3);
    expect(body.items.every((p) => p.tenantId === SEED.tenantId)).toBe(true);
  });

  it('GET /admin/tenants/:tenantId/payments returns 404 for unknown tenant', async () => {
    const response = await fetch(`${BASE}/admin/tenants/unknown-tenant/payments`);
    expect(response.status).toBe(404);
  });

  it('GET /admin/tenants/:tenantId/payments returns the tenant history', async () => {
    const response = await fetch(`${BASE}/admin/tenants/${SEED.tenantId}/payments`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { total: number };
    expect(body.total).toBe(3);
  });

  // ─── POST /billing/payments/:id/proof ────────────────────────────────────────

  it('POST /billing/payments/:id/proof returns 404 for an unknown draftId', async () => {
    const formData = new FormData();
    formData.append('file', new File(['data'], 'proof.pdf', { type: 'application/pdf' }));
    const response = await fetch(`${BASE}/billing/payments/unknown-draft/proof`, {
      method: 'POST',
      body: formData,
    });
    expect(response.status).toBe(404);
  });

  it('POST /billing/payments/:id/proof accepts a valid PDF', async () => {
    const draftId = 'draft-resume-0000-0000-0000-000000000001';
    const formData = new FormData();
    formData.append('file', new File(['data'], 'proof.pdf', { type: 'application/pdf' }));
    const response = await fetch(`${BASE}/billing/payments/${draftId}/proof`, {
      method: 'POST',
      body: formData,
    });
    expect(response.status).toBe(201);
    const body = (await response.json()) as { id: string; filename: string };
    expect(body.filename).toBe('proof.pdf');
  });
});
