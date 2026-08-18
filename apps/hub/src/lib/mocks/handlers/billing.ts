import { http, HttpResponse } from 'msw';

import { db } from '../db';
import { getActiveScenario } from '../scenarios/index';
import { SEED } from '../seed';
import { stableFuture, stableNow } from '../seed-utils';

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

  // Serve mock PDF files (tiny text-based PDF for dev)
  http.get('*/mock-pdf/:filename', ({ params }) => {
    const filename = params['filename'] as string;
    const mockPdfContent = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n% Mock PDF: ${filename}`;
    return new HttpResponse(mockPdfContent, {
      headers: { 'Content-Type': 'application/pdf' },
    });
  }),
];
