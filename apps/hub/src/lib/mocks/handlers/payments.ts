import { http, HttpResponse } from 'msw';

import { SETTLEABLE_STATUSES } from '@/modules/backoffice/payments';

import { db } from '../db';
import { SEED } from '../seed';
import { stableNow } from '../seed-utils';

import { conflict, notFound, unprocessable } from './problem';

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

function paginate<T>(items: T[], page: number, pageSize: number): { items: T[]; total: number } {
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total: items.length };
}

export const paymentsHandlers = [
  // GET /admin/payments — reconciliation queue across tenants
  http.get(`${BASE}/admin/payments`, ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const tenantId = url.searchParams.get('tenantId');
    const reference = url.searchParams.get('reference');
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '20', 10)));

    const all = db.paymentRecord
      .findMany({ where: {} })
      .filter((p) => status === null || p.status === status)
      .filter((p) => tenantId === null || p.tenantId === tenantId)
      .filter((p) => reference === null || p.reference === reference)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const { items, total } = paginate(all, page, pageSize);
    return HttpResponse.json({ items, total, page, pageSize });
  }),

  // POST /admin/payments/:id/confirm — settle via agent, idempotent no-op if already settled
  http.post(`${BASE}/admin/payments/:id/confirm`, async ({ params, request }) => {
    const id = params['id'] as string;
    const body = (await request.json()) as { note?: string };

    if (body.note === undefined || body.note.trim() === '') {
      return unprocessable('payment.note_required');
    }

    const payment = db.paymentRecord.findFirst({ where: { id: { equals: id } } });
    if (payment === null) {
      return notFound('Payment not found');
    }

    // Mirrors UNSETTLED_STATUSES in api-iam's settlement.service.ts. A declined
    // payment is still settleable: the customer keeps the reference and retries.
    // The mock db types status as a plain string, so widen rather than narrow.
    if (!(SETTLEABLE_STATUSES as readonly string[]).includes(payment.status)) {
      return HttpResponse.json(payment);
    }

    const updated = db.paymentRecord.update({
      where: { id: { equals: id } },
      data: {
        status: 'approved',
        settlementKind: 'agent',
        note: body.note,
        settledBy: SEED.userId,
        settledAt: stableNow(),
      },
    });
    return HttpResponse.json(updated);
  }),

  // POST /admin/payments/:id/reject — mandatory note, tenant stays pending, reference retriable
  http.post(`${BASE}/admin/payments/:id/reject`, async ({ params, request }) => {
    const id = params['id'] as string;
    const body = (await request.json()) as { note?: string };

    if (body.note === undefined || body.note.trim() === '') {
      return unprocessable('payment.note_required');
    }

    const payment = db.paymentRecord.findFirst({ where: { id: { equals: id } } });
    if (payment === null) {
      return notFound('Payment not found');
    }

    const updated = db.paymentRecord.update({
      where: { id: { equals: id } },
      data: {
        status: 'declined',
        settlementKind: 'agent',
        note: body.note,
        settledBy: SEED.userId,
        settledAt: stableNow(),
      },
    });
    return HttpResponse.json(updated);
  }),

  // GET /payment-methods — public, only enabled methods, no bank-account details
  http.get(`${BASE}/payment-methods`, () => {
    const items = db.paymentMethodConfig
      .findMany({ where: { enabled: { equals: true } } })
      .map(({ method, displayName }) => ({ method, displayName }));
    return HttpResponse.json({ items });
  }),

  // GET /admin/payment-methods
  http.get(`${BASE}/admin/payment-methods`, () => {
    const items = db.paymentMethodConfig.findMany({ where: {} });
    return HttpResponse.json({ items });
  }),

  // PATCH /admin/payment-methods/:method — last-enabled-method 409 guard
  http.patch(`${BASE}/admin/payment-methods/:method`, async ({ params, request }) => {
    const method = params['method'] as string;
    const body = (await request.json()) as { enabled?: boolean };

    const config = db.paymentMethodConfig.findFirst({ where: { method: { equals: method } } });
    if (config === null) {
      return notFound('Payment method not found');
    }

    if (body.enabled === false) {
      const enabledCount = db.paymentMethodConfig.findMany({ where: { enabled: { equals: true } } }).length;
      if (enabledCount <= 1 && config.enabled) {
        return conflict('payment_method.last_enabled');
      }
    }

    const updated = db.paymentMethodConfig.update({
      where: { method: { equals: method } },
      data: { enabled: body.enabled ?? config.enabled },
    });
    return HttpResponse.json(updated);
  }),

  // GET /billing/payments — tenant payment history
  http.get(`${BASE}/billing/payments`, ({ request }) => {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '10', 10)));

    const all = db.paymentRecord
      .findMany({ where: { tenantId: { equals: SEED.tenantId } } })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const { items, total } = paginate(all, page, pageSize);
    return HttpResponse.json({ items, total, page, pageSize });
  }),

  // GET /admin/tenants/:tenantId/payments
  http.get(`${BASE}/admin/tenants/:tenantId/payments`, ({ params, request }) => {
    const tenantId = params['tenantId'] as string;
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '20', 10)));

    const tenant = db.tenant.findFirst({ where: { id: { equals: tenantId } } });
    if (tenant === null) {
      return notFound('Tenant not found');
    }

    const all = db.paymentRecord
      .findMany({ where: { tenantId: { equals: tenantId } } })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const { items, total } = paginate(all, page, pageSize);
    return HttpResponse.json({ items, total, page, pageSize });
  }),

  // PATCH /admin/tenants/:tenantId/status — activation requires a settlement note
  http.patch(`${BASE}/admin/tenants/:tenantId/status`, async ({ params, request }) => {
    const tenantId = params['tenantId'] as string;
    const body = (await request.json()) as { status?: string; note?: string };
    const status = body.status ?? '';

    const tenant = db.tenant.findFirst({ where: { id: { equals: tenantId } } });
    if (tenant === null) {
      return notFound('Tenant not found');
    }

    if (status === 'active' && (body.note === undefined || body.note.trim() === '')) {
      return unprocessable('payment.note_required');
    }

    const updated = db.tenant.update({ where: { id: { equals: tenantId } }, data: { status } });
    if (updated === null) {
      return notFound('Tenant not found');
    }
    return HttpResponse.json({ id: updated.id, status: updated.status });
  }),

  // POST /billing/payments/:id/proof — draftId-as-capability, no bearer auth
  http.post(`${BASE}/billing/payments/:id/proof`, async ({ params, request }) => {
    const draftId = params['id'] as string;
    const draft = db.draft.findFirst({ where: { id: { equals: draftId } } });
    if (draft === null) {
      return notFound('Draft not found');
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return unprocessable('proof.file_required');
    }
    // ponytail: size/content-type allowlist/max-uploads/rate-limit enforcement is
    // real backend logic (slice 4, task 4.8) — the mock only stubs the shape here.
    const id = `proof-${stableNow()}-${Math.random().toString(36).slice(2, 9)}`;
    const uploadedAt = stableNow();
    db.paymentProof.create({ id, draftId, filename: file.name, uploadedAt });

    return HttpResponse.json({ id, filename: file.name, uploadedAt }, { status: 201 });
  }),
];
