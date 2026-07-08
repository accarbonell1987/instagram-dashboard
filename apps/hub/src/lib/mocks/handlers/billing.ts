import { http, HttpResponse } from 'msw';

import { db } from '../db';
import { SEED } from '../seed';
import { stableFuture, stableNow } from '../seed-utils';
import { getActiveScenario } from '../scenarios/index';

import { conflict, notFound } from './problem';

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

export const billingHandlers = [
  // GET /billing/documents/:documentId/signed-url
  http.get(`${BASE}/billing/documents/:documentId/signed-url`, ({ params }) => {
    const documentId = params['documentId'] as string;
    if (documentId === 'not-found') {
      return notFound('Document not found');
    }

    return HttpResponse.json({
      url: `/mock-pdf/${documentId}.pdf`,
      expiresAt: stableFuture(300),
    });
  }),

  // GET /billing/payment-method
  http.get(`${BASE}/billing/payment-method`, () => {
    const scenario = getActiveScenario();
    const paymentMethod =
      scenario === 'billing-empty'
        ? null
        : { brand: 'visa', lastFour: '4242', expiryMonth: 12, expiryYear: 2027 };
    return HttpResponse.json({ paymentMethod });
  }),

  // POST /billing/payment-method
  http.post(`${BASE}/billing/payment-method`, () => {
    const existing = db.paymentMethodChangeRequest.findFirst({
      where: {
        tenantId: { equals: SEED.tenantId },
        status: { equals: 'pending' },
      },
    });

    if (existing !== null) {
      return conflict('payment_method_change.pending_exists');
    }

    const id = `pmcr-${stableNow()}-${Math.random().toString(36).slice(2, 9)}`;
    db.paymentMethodChangeRequest.create({
      id,
      tenantId: SEED.tenantId,
      createdAt: stableNow(),
      status: 'pending',
    });

    return HttpResponse.json({ id }, { status: 202 });
  }),

  // GET /billing/invoices
  http.get(`${BASE}/billing/invoices`, ({ request }) => {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '10', 10)));

    const allInvoices = db.invoice.findMany({
      where: { tenantId: { equals: SEED.tenantId } },
    });

    // Sort descending by issuedAt
    const sorted = [...allInvoices].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    const total = sorted.length;
    const start = (page - 1) * pageSize;
    const items = sorted.slice(start, start + pageSize);

    return HttpResponse.json({ items, total, page, pageSize });
  }),

  // GET /billing/invoices/:invoiceId/signed-url
  http.get(`${BASE}/billing/invoices/:invoiceId/signed-url`, ({ params }) => {
    const invoiceId = params['invoiceId'] as string;

    const invoice = db.invoice.findFirst({
      where: {
        id: { equals: invoiceId },
        tenantId: { equals: SEED.tenantId },
      },
    });

    if (invoice === null || invoice.documentId === null) {
      return notFound('invoice.not_found');
    }

    return HttpResponse.json({
      url: `/mock-pdf/invoice-${invoiceId}.pdf`,
      expiresAt: stableFuture(300),
    });
  }),

  // Serve mock PDF files (tiny text-based PDF for dev)
  http.get('*/mock-pdf/:filename', ({ params }) => {
    const filename = params['filename'] as string;
    const mockPdfContent = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n% Mock PDF: ${filename}`;
    return new HttpResponse(mockPdfContent, {
      headers: { 'Content-Type': 'application/pdf' },
    });
  }),
];
