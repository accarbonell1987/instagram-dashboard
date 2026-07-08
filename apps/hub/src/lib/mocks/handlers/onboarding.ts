import { http, HttpResponse } from 'msw';

import { db } from '../db';
import { getActiveScenario } from '../scenarios/index';
import { SEED } from '../seed';
import { mintFakeJwt, stableFuture, stableNow } from '../seed-utils';

import { getCachedIdempotent, putIdempotentCache } from './idempotency-cache';
import { notFound, gone } from './problem';

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

const REFRESH_COOKIE = `refresh_token=mock-refresh-token; HttpOnly; Path=/auth/refresh; SameSite=Lax; Max-Age=604800`;
const SESSION_COOKIE = `hub_session=1; Path=/; SameSite=Lax; Max-Age=604800`;

function sessionHeaders(): Headers {
  const h = new Headers();
  h.append('Set-Cookie', REFRESH_COOKIE);
  h.append('Set-Cookie', SESSION_COOKIE);
  return h;
}

// ─── Draft counter (reset on resetDb) ───────────────────────────────────────
let draftCounter = 1;

type GlobalWithMswCounter = typeof globalThis & { __mswResetDraftCounter?: () => void };
const globalWithCounter = global as GlobalWithMswCounter;

globalWithCounter.__mswResetDraftCounter ??= () => { draftCounter = 1; };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildDraftState(draft: ReturnType<typeof db.draft.findFirst>) {
  if (draft === null) return null;

  const plan =
    draft.planId !== null
      ? db.plan.findFirst({ where: { id: { equals: draft.planId } } })
      : null;

  return {
    id: draft.id,
    currentStep: draft.currentStep,
    status: draft.status,
    plan:
      plan !== null
        ? {
            id: plan.id,
            name: plan.name,
            price: plan.price,
            currency: plan.currency,
            billingCycle: plan.billingCycle,
            features: plan.features as string[],
            popular: plan.popular,
          }
        : null,
    representative:
      draft.representativeEmail !== null
        ? { email: draft.representativeEmail, fullName: draft.representativeFullName ?? '', phone: draft.representativePhone ?? '' }
        : null,
    otpVerified: draft.otpVerified,
    company:
      draft.companyLegalName !== null
        ? {
            legalName: draft.companyLegalName,
            ruc: draft.companyRuc ?? '',
            address: draft.companyAddress ?? '',
            city: draft.companyCity ?? '',
            country: draft.companyCountry ?? 'PY',
          }
        : null,
    payment:
      draft.paymentId !== null
        ? buildPaymentForDraft(draft.paymentId)
        : null,
    version: draft.version,
    expiresAt: draft.expiresAt,
  };
}

function buildPaymentForDraft(paymentId: string) {
  const payment = db.payment.findFirst({ where: { id: { equals: paymentId } } });
  if (payment === null) return null;
  return { paymentId: payment.id, status: payment.status, bancardProcessId: null };
}

function newDraftId(): string {
  return `draft-${String(draftCounter++).padStart(4, '0')}-0000-0000-0000-000000000001`;
}

// ─── Handlers ────────────────────────────────────────────────────────────────

export const onboardingHandlers = [
  // POST /onboarding/draft
  http.post(`${BASE}/onboarding/draft`, async ({ request }) => {
    const idemKey = request.headers.get('Idempotency-Key');
    if (idemKey !== null) {
      const cached = getCachedIdempotent(idemKey);
      if (cached !== null) return cached;
    }

    const body = (await request.json()) as { planId?: string | null };
    const planId = body.planId ?? null;
    const firstStep = planId !== null ? 'representative' : 'plan';
    const draftId = newDraftId();

    const draft = db.draft.create({
      id: draftId,
      currentStep: firstStep,
      status: 'draft',
      planId: planId,
      representativeEmail: null,
      representativeFullName: null,
      representativePhone: null,
      companyLegalName: null,
      companyRuc: null,
      companyAddress: null,
      companyCity: null,
      companyCountry: null,
      otpVerified: false,
      paymentId: null,
      version: 1,
      expiresAt: stableFuture(7 * 24 * 3600),
    });

    const responseBody = buildDraftState(draft);
    if (idemKey !== null) putIdempotentCache(idemKey, 201, responseBody);
    return HttpResponse.json(responseBody, { status: 201 });
  }),

  // GET /onboarding/draft/resume/:opaqueToken
  http.get(`${BASE}/onboarding/draft/resume/:opaqueToken`, ({ params }) => {
    const token = params['opaqueToken'] as string;
    const scenario = getActiveScenario();

    if (scenario === 'invitation-expired') {
      return gone('Resume token expired');
    }

    const record = db.resumeToken.findFirst({ where: { token: { equals: token } } });
    if (record === null) {
      return HttpResponse.json(
        { code: 'onboarding.resume_token_invalid', message: 'Resume token not found or expired' },
        { status: 410 }
      );
    }
    if (record.used || record.expiresAt < Date.now()) {
      return gone('Resume token expired or already used');
    }

    db.resumeToken.update({ where: { token: { equals: token } }, data: { used: true } });
    return HttpResponse.json({ draftId: record.draftId });
  }),

  // GET /onboarding/draft/:draftId
  http.get(`${BASE}/onboarding/draft/:draftId`, ({ params }) => {
    const draftId = params['draftId'] as string;
    const draft = db.draft.findFirst({ where: { id: { equals: draftId } } });

    if (draft === null) return notFound('Draft not found');
    if (draft.status === 'expired') return gone('Draft expired');

    return HttpResponse.json(buildDraftState(draft));
  }),

  // PATCH /onboarding/draft/:draftId
  http.patch(`${BASE}/onboarding/draft/:draftId`, async ({ params, request }) => {
    const idemKey = request.headers.get('Idempotency-Key');
    if (idemKey !== null) {
      const cached = getCachedIdempotent(idemKey);
      if (cached !== null) return cached;
    }

    const draftId = params['draftId'] as string;
    const body = (await request.json()) as {
      step: string;
      version: number;
      plan?: { id: string } | null;
      representative?: { email: string; fullName: string; phone?: string } | null;
      company?: { legalName: string; ruc: string; address: string; city: string; country?: string } | null;
    };

    const draft = db.draft.findFirst({ where: { id: { equals: draftId } } });
    if (draft === null) return notFound('Draft not found');

    if (body.version !== draft.version) {
      return HttpResponse.json(buildDraftState(draft), { status: 409 });
    }

    const stepOrder = ['plan', 'representative', 'otp', 'company', 'payment', 'summary'];
    const currentIndex = stepOrder.indexOf(body.step);
    const nextStep = currentIndex < stepOrder.length - 1 ? stepOrder[currentIndex + 1] : body.step;

    const updates: Record<string, unknown> = { currentStep: nextStep, version: draft.version + 1 };

    if (body.step === 'otp') updates['otpVerified'] = true;
    if (body.plan != null) updates['planId'] = body.plan.id;
    if (body.representative != null) {
      updates['representativeEmail'] = body.representative.email;
      updates['representativeFullName'] = body.representative.fullName;
      updates['representativePhone'] = body.representative.phone ?? '';
    }
    if (body.company != null) {
      updates['companyLegalName'] = body.company.legalName;
      updates['companyRuc'] = body.company.ruc;
      updates['companyAddress'] = body.company.address;
      updates['companyCity'] = body.company.city;
      updates['companyCountry'] = body.company.country ?? 'PY';
    }

    const updated = db.draft.update({ where: { id: { equals: draftId } }, data: updates });
    const responseBody = buildDraftState(updated);
    if (idemKey !== null) putIdempotentCache(idemKey, 200, responseBody);
    return HttpResponse.json(responseBody);
  }),

  // POST /onboarding/draft/:draftId/resume-link
  http.post(`${BASE}/onboarding/draft/:draftId/resume-link`, ({ params, request }) => {
    const idemKey = request.headers.get('Idempotency-Key');
    if (idemKey !== null) {
      const cached = getCachedIdempotent(idemKey);
      if (cached !== null) return cached;
    }

    const draftId = params['draftId'] as string;
    const draft = db.draft.findFirst({ where: { id: { equals: draftId } } });
    if (draft === null) return notFound('Draft not found');

    const token = `resume-token-${draftId}`;
    const existing = db.resumeToken.findFirst({ where: { token: { equals: token } } });
    if (existing === null) {
      db.resumeToken.create({ token, draftId, expiresAt: Date.now() + 24 * 3600 * 1000, used: false });
    }

    const responseBody = { sent: true };
    if (idemKey !== null) putIdempotentCache(idemKey, 202, responseBody);
    return HttpResponse.json(responseBody, { status: 202 });
  }),

  // POST /onboarding/draft/:draftId/payment/initiate
  http.post(`${BASE}/onboarding/draft/:draftId/payment/initiate`, ({ params, request }) => {
    const idemKey = request.headers.get('Idempotency-Key');
    if (idemKey !== null) {
      const cached = getCachedIdempotent(idemKey);
      if (cached !== null) return cached;
    }

    const draftId = params['draftId'] as string;
    const draft = db.draft.findFirst({ where: { id: { equals: draftId } } });
    if (draft === null) return notFound('Draft not found');

    const paymentId = `payment-${draftId.substring(0, 8)}-0001`;
    const scenario = getActiveScenario();
    const initialStatus = scenario === 'payment-cancelled' ? 'declined' : 'pending';

    const existing = db.payment.findFirst({ where: { id: { equals: paymentId } } });
    if (existing === null) {
      db.payment.create({
        id: paymentId,
        draftId,
        status: initialStatus,
        redirectUrl: `http://localhost:3001/signup/${draftId}/payment?status=verifying`,
        pollCount: 0,
      });
      db.draft.update({ where: { id: { equals: draftId } }, data: { paymentId } });
    }

    const responseBody = {
      paymentId,
      redirectUrl: `http://localhost:3001/signup/${draftId}/payment?status=verifying`,
      expiresAt: stableFuture(900),
    };

    if (idemKey !== null) putIdempotentCache(idemKey, 200, responseBody);
    return HttpResponse.json(responseBody);
  }),

  // GET /onboarding/draft/:draftId/payment/status
  http.get(`${BASE}/onboarding/draft/:draftId/payment/status`, ({ params }) => {
    const draftId = params['draftId'] as string;
    const scenario = getActiveScenario();
    const draft = db.draft.findFirst({ where: { id: { equals: draftId } } });

    if (draft === null) return notFound('Draft not found');

    const paymentId = draft.paymentId ?? `payment-${draftId.substring(0, 8)}-0001`;
    let payment = db.payment.findFirst({ where: { id: { equals: paymentId } } });

    let status: string;

    if (scenario === 'payment-cancelled') {
      status = 'declined';
    } else if (scenario === 'payment-timeout') {
      status = 'pending';
    } else {
      // happy: pending for first 2 polls, then approved
      if (payment !== null) {
        const pollCount = payment.pollCount + 1;
        payment = db.payment.update({ where: { id: { equals: paymentId } }, data: { pollCount } });
        status = pollCount >= 3 ? 'approved' : 'pending';
        if (status === 'approved' && payment?.status !== 'approved') {
          db.payment.update({ where: { id: { equals: paymentId } }, data: { status: 'approved' } });
        }
      } else {
        status = 'pending';
      }
    }

    return HttpResponse.json({
      paymentId,
      status,
      reason: null,
      confirmedAt: status === 'approved' ? stableNow() : null,
    });
  }),

  // POST /onboarding/draft/:draftId/submit
  http.post(`${BASE}/onboarding/draft/:draftId/submit`, ({ params, request }) => {
    const idemKey = request.headers.get('Idempotency-Key');
    if (idemKey !== null) {
      const cached = getCachedIdempotent(idemKey);
      if (cached !== null) return cached;
    }

    const draftId = params['draftId'] as string;
    const draft = db.draft.findFirst({ where: { id: { equals: draftId } } });
    if (draft === null) return notFound('Draft not found');

    const tenantId = `tenant-${draftId.substring(0, 8)}-0001`;
    const tenantSlug = (draft.companyLegalName ?? 'empresa-nueva')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .substring(0, 40);

    let tenant = db.tenant.findFirst({ where: { id: { equals: tenantId } } });
    tenant ??= db.tenant.create({
      id: tenantId,
      slug: tenantSlug,
      name: draft.companyLegalName ?? 'Nueva Empresa',
      planId: draft.planId ?? SEED.planProfessional,
      status: 'active',
    });

    const accessToken = mintFakeJwt({
      sub: SEED.userId,
      tenant_id: tenantSlug,
      tenant_uuid: tenantId,
      tenant_slug: tenantSlug,
      role: 'TenantAdmin',
    });

    const responseBody = {
      tenantId,
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, planId: tenant.planId, status: tenant.status },
      accessToken,
      expiresIn: 900,
      // Bug 9 fix: backend now returns document IDs, not pre-signed URLs
      documents: {
        invoiceId: `mock-invoice-${tenantId}`,
        contractId: `mock-contract-${tenantId}`,
      },
    };

    if (idemKey !== null) putIdempotentCache(idemKey, 200, responseBody);
    return HttpResponse.json(responseBody, { headers: sessionHeaders() });
  }),
];
