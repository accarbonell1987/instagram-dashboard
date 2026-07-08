import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { MiddlewareHandler } from 'hono';
import { setCookie } from 'hono/cookie';
import type { DraftService, PaymentService, SubmitService } from '../../services/index.js';
import type { PlanRepository, PaymentRepository } from '../../repositories/index.js';
import type { OnboardingDraft, Plan, Payment } from '../../domain/index.js';
import type { DraftStatus } from '../../domain/index.js';
import type { Config } from '../../config.js';
import {
  CreateDraftRequestSchema,
  DraftStateSchema,
  UpdateDraftRequestSchema,
  RecoverDraftRequestSchema,
  ResumeTokenResolutionSchema,
  ResumeLinkRequestSchema,
  ResumeLinkResponseSchema,
  PaymentInitiateResponseSchema,
  PaymentStatusSchema,
  SubmitResponseSchema,
  commonErrorResponses,
} from '../schemas/index.js';

// ---- helpers -----------------------------------------------------------------

// Bug 2 fix: hub_session + refresh_token set together so Next.js middleware can see session presence.
// Mirrors setRefreshCookie in routes/auth/index.ts — must stay in sync.
function setRefreshCookie(c: Parameters<typeof setCookie>[0], raw: string, config: Config): void {
  setCookie(c, 'refresh_token', raw, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/auth/refresh',
    maxAge: config.JWT_REFRESH_TOKEN_TTL_SECONDS,
  });
  setCookie(c, 'hub_session', '1', {
    httpOnly: false,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: config.JWT_REFRESH_TOKEN_TTL_SECONDS,
  });
}

function mapFeatures(features: unknown): string[] {
  if (Array.isArray(features)) {
    return features.filter((v): v is string => typeof v === 'string');
  }
  if (typeof features === 'object' && features !== null) {
    return Object.values(features as Record<string, unknown>).filter(
      (v): v is string => typeof v === 'string'
    );
  }
  return [];
}

// Statuses that mean the OTP verification step has been completed
const OTP_VERIFIED_STATUSES: ReadonlySet<DraftStatus> = new Set([
  'otp_verified',
  'payment_pending',
  'payment_confirmed',
  'completed',
]);

// Map domain PaymentStatus (has 'reversed') → contract PaymentStatus (has 'timeout')
function mapPaymentStatus(
  status: string
): 'pending' | 'approved' | 'declined' | 'cancelled' | 'timeout' {
  if (status === 'reversed') return 'timeout';
  return status as 'pending' | 'approved' | 'declined' | 'cancelled' | 'timeout';
}

/**
 * Reshape a flat DB draft + optional plan + payment into the contract-compliant
 * nested DraftState shape.
 *
 * @see apps/hub/.atl/api-contract.yaml — DraftState schema
 */
function draftToJson(
  draft: OnboardingDraft,
  plan: Plan | null | undefined,
  payment: Payment | null | undefined
) {
  // ── plan ──────────────────────────────────────────────────────────────────
  const planJson = plan
    ? {
        id: plan.id,
        name: plan.name,
        price: plan.price,
        currency: plan.currency,
        billingCycle: plan.billingInterval as 'monthly' | 'yearly', // DB column → contract field
        features: mapFeatures(plan.features),
        popular: plan.popular,
      }
    : null;

  // ── representative ────────────────────────────────────────────────────────
  const repData = draft.data['representative'] as Record<string, unknown> | undefined;
  const repEmail =
    (repData ? (repData['email'] as string) : undefined) || draft.representativeEmail || undefined;
  const representative = repEmail
    ? {
        email: repEmail,
        ...(repData &&
          repData['fullName'] !== undefined && { fullName: repData['fullName'] as string }),
        ...(repData && repData['phone'] !== undefined && { phone: repData['phone'] as string }),
      }
    : null;

  // ── otpVerified ───────────────────────────────────────────────────────────
  const otpVerified = OTP_VERIFIED_STATUSES.has(draft.status as DraftStatus);

  // ── company ───────────────────────────────────────────────────────────────
  const companyData = draft.data['company'] as Record<string, unknown> | null | undefined;
  const company = companyData
    ? {
        ...(companyData['legalName'] !== undefined && {
          legalName: companyData['legalName'] as string,
        }),
        ...(companyData['ruc'] !== undefined && { ruc: companyData['ruc'] as string }),
        ...(companyData['address'] !== undefined && { address: companyData['address'] as string }),
        ...(companyData['city'] !== undefined && { city: companyData['city'] as string }),
        ...(companyData['country'] !== undefined && { country: companyData['country'] as string }),
      }
    : null;

  // ── payment ───────────────────────────────────────────────────────────────
  const paymentJson = payment
    ? {
        paymentId: payment.id,
        status: mapPaymentStatus(payment.status),
        bancardProcessId: payment.bancardProcessId,
      }
    : null;

  return {
    id: draft.id,
    currentStep: draft.currentStep,
    status: draft.status,
    version: draft.version,
    plan: planJson,
    representative,
    otpVerified,
    company,
    payment: paymentJson,
    expiresAt: draft.expiresAt.toISOString(),
  };
}

// ---- router factory ---------------------------------------------------------

export function createOnboardingRouter(
  draftService: DraftService,
  paymentService: PaymentService,
  submitService: SubmitService,
  idempotency: MiddlewareHandler,
  authGuard: MiddlewareHandler,
  config: Config,
  planRepo: PlanRepository,
  paymentRepo: PaymentRepository
) {
  const router = new OpenAPIHono();

  // ── POST /onboarding/draft ──────────────────────────────────────────────
  const createDraftRoute = createRoute({
    method: 'post',
    path: '/onboarding/draft',
    operationId: 'createDraft',
    tags: ['onboarding'],
    security: [],
    request: {
      body: {
        content: { 'application/json': { schema: CreateDraftRequestSchema } },
      },
    },
    responses: {
      201: {
        content: { 'application/json': { schema: DraftStateSchema } },
        description: 'Draft created',
      },
      400: commonErrorResponses[400],
      422: commonErrorResponses[422],
    },
  });

  router.use('/onboarding/draft', async (c, next) => {
    if (c.req.method === 'POST') return idempotency(c, next);
    await next();
  });

  router.openapi(createDraftRoute, async (c) => {
    const { planId } = c.req.valid('json');
    const ipAddress = c.req.header('X-Forwarded-For') ?? c.req.header('X-Real-IP') ?? 'unknown';
    const draft = await draftService.createDraft({ planId: planId ?? undefined, ipAddress });
    // createDraft already validates plan existence; fetch it for the response
    const plan = draft.planId ? await planRepo.findById(draft.planId).catch(() => null) : null;
    return c.json(draftToJson(draft, plan, null), 201);
  });

  // ── GET /onboarding/draft/:draftId ─────────────────────────────────────
  const getDraftRoute = createRoute({
    method: 'get',
    path: '/onboarding/draft/{draftId}',
    operationId: 'getDraft',
    tags: ['onboarding'],
    security: [],
    request: {
      params: z.object({ draftId: z.string() }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: DraftStateSchema } },
        description: 'Draft state',
      },
      404: commonErrorResponses[404],
      410: commonErrorResponses[410],
    },
  });

  router.openapi(getDraftRoute, async (c) => {
    const { draftId } = c.req.valid('param');
    const draft = await draftService.getDraft(draftId);
    const [plan, payment] = await Promise.all([
      draft.planId ? planRepo.findById(draft.planId).catch(() => null) : null,
      paymentRepo.findByDraftId(draftId),
    ]);
    return c.json(draftToJson(draft, plan, payment), 200);
  });

  // ── PATCH /onboarding/draft/:draftId ───────────────────────────────────
  const updateDraftRoute = createRoute({
    method: 'patch',
    path: '/onboarding/draft/{draftId}',
    operationId: 'updateDraft',
    tags: ['onboarding'],
    security: [],
    request: {
      params: z.object({ draftId: z.string() }),
      body: {
        content: { 'application/json': { schema: UpdateDraftRequestSchema } },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: DraftStateSchema } },
        description: 'Draft updated',
      },
      400: commonErrorResponses[400],
      409: commonErrorResponses[409],
      410: commonErrorResponses[410],
      422: commonErrorResponses[422],
    },
  });

  router.use('/onboarding/draft/:draftId', async (c, next) => {
    if (c.req.method === 'PATCH') return idempotency(c, next);
    await next();
  });

  router.openapi(updateDraftRoute, async (c) => {
    const { draftId } = c.req.valid('param');
    const body = c.req.valid('json');
    const ipAddress = c.req.header('X-Forwarded-For') ?? c.req.header('X-Real-IP') ?? 'unknown';
    const draft = await draftService.updateDraft({
      draftId,
      update: {
        version: body.version,
        step: body.step,
        plan: body.plan,
        representative: body.representative,
        company: body.company,
      },
      ipAddress,
    });
    const [plan, payment] = await Promise.all([
      draft.planId ? planRepo.findById(draft.planId).catch(() => null) : null,
      paymentRepo.findByDraftId(draftId),
    ]);
    return c.json(draftToJson(draft, plan, payment), 200);
  });

  // ── GET /onboarding/draft/resume/:token ────────────────────────────────
  const resolveResumeTokenRoute = createRoute({
    method: 'get',
    path: '/onboarding/draft/resume/{token}',
    operationId: 'resolveResumeToken',
    tags: ['onboarding'],
    security: [],
    request: {
      params: z.object({ token: z.string() }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: ResumeTokenResolutionSchema } },
        description: 'Resume token resolved',
      },
      410: commonErrorResponses[410],
    },
  });

  router.openapi(resolveResumeTokenRoute, async (c) => {
    const { token } = c.req.valid('param');
    const result = await draftService.resolveResumeToken(token);
    return c.json(result, 200);
  });

  // ── POST /onboarding/draft/:draftId/resume-link ────────────────────────
  const sendResumeLinkRoute = createRoute({
    method: 'post',
    path: '/onboarding/draft/{draftId}/resume-link',
    operationId: 'sendResumeLink',
    tags: ['onboarding'],
    security: [],
    request: {
      params: z.object({ draftId: z.string() }),
      body: {
        content: { 'application/json': { schema: ResumeLinkRequestSchema } },
      },
    },
    responses: {
      202: {
        content: { 'application/json': { schema: ResumeLinkResponseSchema } },
        description: 'Resume link sent',
      },
      400: commonErrorResponses[400],
      404: commonErrorResponses[404],
      410: commonErrorResponses[410],
    },
  });

  router.use('/onboarding/draft/:draftId/resume-link', idempotency);

  router.openapi(sendResumeLinkRoute, async (c) => {
    const { draftId } = c.req.valid('param');
    // The `email` from the request body is intentionally ignored.
    // The backend always sends the resume link to `representativeEmail` stored in the draft
    // for security — trusting an email from the request body would allow link hijacking.
    await draftService.sendResumeLink(draftId);
    return c.json({ sent: true as const }, 202);
  });

  // ── POST /onboarding/draft/:draftId/payment/initiate ──────────────────
  const initiatePaymentRoute = createRoute({
    method: 'post',
    path: '/onboarding/draft/{draftId}/payment/initiate',
    operationId: 'initiatePayment',
    tags: ['onboarding'],
    security: [],
    request: {
      params: z.object({ draftId: z.string() }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: PaymentInitiateResponseSchema } },
        description: 'Payment initiated',
      },
      400: commonErrorResponses[400],
      409: commonErrorResponses[409],
      422: commonErrorResponses[422],
    },
  });

  router.use('/onboarding/draft/:draftId/payment/initiate', idempotency);

  router.openapi(initiatePaymentRoute, async (c) => {
    const { draftId } = c.req.valid('param');
    const idempotencyReset = c.var.idempotencyReset ?? false;
    const result = await paymentService.initiatePayment({ draftId, idempotencyReset });
    return c.json(
      {
        paymentId: result.paymentId,
        redirectUrl: result.redirectUrl,
        expiresAt: result.expiresAt.toISOString(),
      },
      200
    );
  });

  // ── GET /onboarding/draft/:draftId/payment/status ─────────────────────
  const getPaymentStatusRoute = createRoute({
    method: 'get',
    path: '/onboarding/draft/{draftId}/payment/status',
    operationId: 'getPaymentStatus',
    tags: ['onboarding'],
    security: [],
    request: {
      params: z.object({ draftId: z.string() }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: PaymentStatusSchema } },
        description: 'Payment status',
      },
      404: commonErrorResponses[404],
    },
  });

  router.openapi(getPaymentStatusRoute, async (c) => {
    const { draftId } = c.req.valid('param');
    const result = await paymentService.getPaymentStatus(draftId);
    const status: 'pending' | 'approved' | 'declined' | 'cancelled' | 'timeout' =
      result.status === 'reversed'
        ? 'timeout'
        : (result.status as 'pending' | 'approved' | 'declined' | 'cancelled' | 'timeout');
    return c.json(
      {
        paymentId: result.paymentId ?? draftId, // fallback to draftId when no payment exists
        status,
        reason: null,
        confirmedAt: result.confirmedAt?.toISOString() ?? null,
      },
      200
    );
  });

  // ── PATCH /onboarding/draft/:draftId/recover ──────────────────────────
  const recoverDraftRoute = createRoute({
    method: 'patch',
    path: '/onboarding/draft/{draftId}/recover',
    operationId: 'recoverDraft',
    tags: ['onboarding'],
    security: [],
    request: {
      params: z.object({ draftId: z.string() }),
      body: {
        content: { 'application/json': { schema: RecoverDraftRequestSchema } },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: DraftStateSchema } },
        description: 'Draft recovered — specified step data cleared',
      },
      404: commonErrorResponses[404],
      409: commonErrorResponses[409],
      410: commonErrorResponses[410],
    },
  });

  router.openapi(recoverDraftRoute, async (c) => {
    const { draftId } = c.req.valid('param');
    const { step } = c.req.valid('json');
    const draft = await draftService.recoverDraft({ draftId, step });
    const [plan, payment] = await Promise.all([
      draft.planId ? planRepo.findById(draft.planId).catch(() => null) : null,
      paymentRepo.findByDraftId(draftId),
    ]);
    return c.json(draftToJson(draft, plan, payment), 200);
  });

  // ── POST /onboarding/draft/:draftId/submit ────────────────────────────
  const submitDraftRoute = createRoute({
    method: 'post',
    path: '/onboarding/draft/{draftId}/submit',
    operationId: 'submitDraft',
    tags: ['onboarding'],
    security: [],
    request: {
      params: z.object({ draftId: z.string() }),
      body: {
        content: { 'application/json': { schema: z.object({ version: z.number().int() }) } },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: SubmitResponseSchema } },
        description: 'Draft submitted — tenant provisioned',
      },
      400: commonErrorResponses[400],
      409: commonErrorResponses[409],
      500: commonErrorResponses[500],
    },
  });

  router.use('/onboarding/draft/:draftId/submit', idempotency);

  router.openapi(submitDraftRoute, async (c) => {
    const { draftId } = c.req.valid('param');
    const { version } = c.req.valid('json');
    const result = await submitService.submit({ draftId, version });

    // Bug 2 fix: use setRefreshCookie so hub_session is also set (Next.js middleware gate)
    setRefreshCookie(c, result.refreshTokenRaw, config);

    return c.json(
      {
        tenantId: result.tenantId,
        tenant: {
          id: result.tenant.id,
          slug: result.tenant.slug,
          name: result.tenant.name,
        },
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        documents: result.documents,
      },
      200
    );
  });

  return router;
}
