import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { createHash } from 'node:crypto';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type {
  AuthService,
  OtpService,
  FirstLoginService,
  PasswordService,
} from '../../services/index.js';
import type { KeyProvider } from '../../adapters/index.js';
import type { OnboardingDraftRepository } from '../../repositories/index.js';
import type { Config } from '../../config.js';
import { UnauthorizedError } from '../../errors.js';
import {
  LoginRequestSchema,
  LoginResponseSchema,
  LoginCompleteRequestSchema,
  OtpSendRequestSchema,
  OtpSendResponseSchema,
  OtpVerifyRequestSchema,
  OtpVerifyResponseSchema,
  OtpResendRequestSchema,
  OtpResendResponseSchema,
  RefreshResponseSchema,
  PasswordPolicySchema,
  PasswordRecoverRequestSchema,
  PasswordRecoverCompleteRequestSchema,
  FirstLoginStartRequestSchema,
  FirstLoginSetPasswordRequestSchema,
  ActivationTokenValidateQuerySchema,
  ActivationTokenValidateResponseSchema,
  SessionSchema,
  UserSchema,
  TenantInSessionSchema,
  commonErrorResponses,
} from '../schemas/index.js';

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function setRefreshCookie(c: Parameters<typeof setCookie>[0], raw: string, config: Config): void {
  setCookie(c, 'refresh_token', raw, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/auth/refresh',
    maxAge: config.JWT_REFRESH_TOKEN_TTL_SECONDS,
  });
  // hub_session is a presence-only cookie (not httpOnly) so the Next.js middleware
  // can read it on all routes and redirect to /login when no session exists.
  // It carries no sensitive data — the real auth gate is the refresh_token cookie.
  setCookie(c, 'hub_session', '1', {
    httpOnly: false,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: config.JWT_REFRESH_TOKEN_TTL_SECONDS,
  });
}

function deleteHubSessionCookie(c: Parameters<typeof deleteCookie>[0]): void {
  deleteCookie(c, 'hub_session', { path: '/' });
}

export function createAuthRouter(
  authService: AuthService,
  otpService: OtpService,
  firstLoginService: FirstLoginService,
  passwordService: PasswordService,
  keyProvider: KeyProvider,
  config: Config,
  idempotency: MiddlewareHandler,
  authGuard: MiddlewareHandler,
  draftRepo: OnboardingDraftRepository,
  prisma: PrismaClient
) {
  const router = new OpenAPIHono();

  // ── POST /auth/login ───────────────────────────────────────────────────
  // No idempotency — each login attempt is independent
  const loginRoute = createRoute({
    method: 'post',
    path: '/auth/login',
    operationId: 'login',
    tags: ['auth'],
    security: [],
    request: {
      body: {
        content: { 'application/json': { schema: LoginRequestSchema } },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: LoginResponseSchema } },
        description: 'Login step 1 result',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      422: commonErrorResponses[422],
      429: commonErrorResponses[429],
    },
  });

  router.openapi(loginRoute, async (c) => {
    const { email, password, deviceId } = c.req.valid('json');
    const ipAddress = c.req.header('X-Forwarded-For') ?? c.req.header('X-Real-IP') ?? 'unknown';

    const result = await authService.login({ email, password, deviceId, ipAddress });

    if (!result.otpRequired) {
      setRefreshCookie(c, result.refreshTokenRaw, config);
      return c.json({ otpRequired: false as const, session: result.session }, 200);
    }

    return c.json(
      {
        otpRequired: true as const,
        otpId: result.otpId,
        channel: result.channel,
        maskedDestination: result.maskedDestination,
        expiresAt: result.expiresAt.toISOString(),
        resendAvailableAt: result.resendAvailableAt.toISOString(),
      },
      200
    );
  });

  // ── POST /auth/login/complete ──────────────────────────────────────────
  router.use('/auth/login/complete', idempotency);

  const loginCompleteRoute = createRoute({
    method: 'post',
    path: '/auth/login/complete',
    operationId: 'loginComplete',
    tags: ['auth'],
    security: [],
    request: {
      body: {
        content: { 'application/json': { schema: LoginCompleteRequestSchema } },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: SessionSchema } },
        description: 'Session issued',
      },
      400: commonErrorResponses[400],
      401: commonErrorResponses[401],
      422: commonErrorResponses[422],
      429: commonErrorResponses[429],
    },
  });

  router.openapi(loginCompleteRoute, async (c) => {
    const body = c.req.valid('json');
    const result = await authService.loginComplete({
      otpId: body.otpId,
      code: body.code,
      trustDevice: body.trustDevice,
      deviceId: body.deviceId,
    });

    setRefreshCookie(c, result.refreshTokenRaw, config);

    // Set device_trust cookie with the hash computed by the service (Opción C)
    if (result.setDeviceTrustCookie && result.deviceHash !== undefined) {
      setCookie(c, 'device_trust', result.deviceHash, {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        maxAge: config.DEVICE_TRUST_TTL_SECONDS,
      });
    }

    return c.json(result.session, 200);
  });

  // ── POST /auth/otp/send ────────────────────────────────────────────────
  router.use('/auth/otp/send', idempotency);

  const otpSendRoute = createRoute({
    method: 'post',
    path: '/auth/otp/send',
    operationId: 'sendOtp',
    tags: ['auth'],
    security: [],
    request: {
      body: {
        content: { 'application/json': { schema: OtpSendRequestSchema } },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: OtpSendResponseSchema } },
        description: 'OTP sent',
      },
      400: commonErrorResponses[400],
      429: commonErrorResponses[429],
    },
  });

  router.openapi(otpSendRoute, async (c) => {
    const { identifier, channel, purpose } = c.req.valid('json');
    const ipAddress = c.req.header('X-Forwarded-For') ?? c.req.header('X-Real-IP') ?? 'unknown';
    const result = await otpService.sendOtp({ identifier, channel, purpose, ipAddress });
    return c.json(
      {
        otpId: result.otpId,
        channel: result.channel,
        maskedDestination: result.maskedDestination,
        expiresAt: result.expiresAt.toISOString(),
        resendAvailableAt: result.resendAvailableAt.toISOString(),
      },
      200
    );
  });

  // ── POST /auth/otp/verify ─────────────────────────────────────────────
  router.use('/auth/otp/verify', idempotency);

  const otpVerifyRoute = createRoute({
    method: 'post',
    path: '/auth/otp/verify',
    operationId: 'verifyOtp',
    tags: ['auth'],
    security: [],
    request: {
      body: {
        content: { 'application/json': { schema: OtpVerifyRequestSchema } },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: OtpVerifyResponseSchema } },
        description: 'OTP verification token',
      },
      400: commonErrorResponses[400],
      422: commonErrorResponses[422],
      429: commonErrorResponses[429],
    },
  });

  router.openapi(otpVerifyRoute, async (c) => {
    const { otpId, code } = c.req.valid('json');

    // Look up OTP purpose before dispatching
    const { purpose } = await otpService.lookupPurpose(otpId);

    let otpVerificationToken: string;

    // IAM-AUTH-012: when purpose=signup-rep, use verifyOtpCodeOnly (no user exists yet)
    // and update the draft status to otp_verified inline (replaces deprecated SignupRepService).
    if (purpose === 'signup-rep') {
      const { identifier } = await otpService.verifyOtpCodeOnly(otpId, code);

      await prisma.$transaction(async (tx) => {
        const draft = await draftRepo.findByRepresentativeEmail(identifier);
        if (draft) {
          await draftRepo.update(draft.id, { status: 'otp_verified' }, tx);
        }
      });

      otpVerificationToken = ''; // no user yet — token not needed
    } else {
      const result = await otpService.verifyOtp({
        otpId,
        code,
        keyProvider,
        config,
      });
      otpVerificationToken = result.verificationToken;
    }

    const expiresAt = new Date(Date.now() + config.JWT_OTP_VERIFICATION_TTL_SECONDS * 1000);
    return c.json(
      {
        otpVerificationToken,
        expiresAt: expiresAt.toISOString(),
      },
      200
    );
  });

  // ── POST /auth/otp/resend ─────────────────────────────────────────────
  router.use('/auth/otp/resend', idempotency);

  const otpResendRoute = createRoute({
    method: 'post',
    path: '/auth/otp/resend',
    operationId: 'resendOtp',
    tags: ['auth'],
    security: [],
    request: {
      body: {
        content: { 'application/json': { schema: OtpResendRequestSchema } },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: OtpResendResponseSchema } },
        description: 'OTP resent',
      },
      400: commonErrorResponses[400],
      429: commonErrorResponses[429],
    },
  });

  router.openapi(otpResendRoute, async (c) => {
    const { otpId } = c.req.valid('json');
    const ipAddress = c.req.header('X-Forwarded-For') ?? c.req.header('X-Real-IP') ?? 'unknown';

    // Look up the original OTP to get the identifier and purpose
    const { purpose, identifier } = await otpService.lookupPurpose(otpId);

    // Re-send OTP for the same identifier/channel/purpose
    // The rate limiter inside sendOtp enforces the cooldown (30s window)
    const result = await otpService.sendOtp({
      identifier,
      channel: 'email',
      purpose,
      ipAddress,
    });

    return c.json(
      {
        otpId: result.otpId,
        channel: result.channel,
        maskedDestination: result.maskedDestination,
        expiresAt: result.expiresAt.toISOString(),
        resendAvailableAt: result.resendAvailableAt.toISOString(),
      },
      200
    );
  });

  // ── POST /auth/refresh ────────────────────────────────────────────────
  const refreshRoute = createRoute({
    method: 'post',
    path: '/auth/refresh',
    operationId: 'refreshSession',
    tags: ['auth'],
    security: [],
    responses: {
      200: {
        content: { 'application/json': { schema: RefreshResponseSchema } },
        description: 'New access token',
      },
      401: commonErrorResponses[401],
    },
  });

  router.openapi(refreshRoute, async (c) => {
    const refreshTokenRaw = getCookie(c, 'refresh_token');
    if (!refreshTokenRaw) {
      throw new UnauthorizedError('auth.refresh_invalid');
    }
    const result = await authService.refresh({ refreshTokenRaw });
    setRefreshCookie(c, result.newRawToken, config);
    return c.json(
      {
        accessToken: result.session.accessToken,
        expiresIn: result.session.expiresIn,
      },
      200
    );
  });

  // ── POST /auth/logout ─────────────────────────────────────────────────
  router.use('/auth/logout', idempotency);

  const logoutRoute = createRoute({
    method: 'post',
    path: '/auth/logout',
    operationId: 'logout',
    tags: ['auth'],
    security: [],
    responses: {
      204: {
        description: 'Logged out',
      },
      400: commonErrorResponses[400],
    },
  });

  router.openapi(logoutRoute, async (c) => {
    const refreshTokenRaw = getCookie(c, 'refresh_token');
    if (refreshTokenRaw) {
      const refreshTokenHash = hashToken(refreshTokenRaw);
      await authService.logout({ refreshTokenHash });
    }
    deleteCookie(c, 'refresh_token', {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/auth/refresh',
    });
    deleteHubSessionCookie(c);
    return new Response(null, { status: 204 });
  });

  // ── GET /auth/password/policy ─────────────────────────────────────────
  const passwordPolicyRoute = createRoute({
    method: 'get',
    path: '/auth/password/policy',
    operationId: 'getPasswordPolicy',
    tags: ['auth'],
    security: [],
    responses: {
      200: {
        content: { 'application/json': { schema: PasswordPolicySchema } },
        description: 'Password policy',
      },
    },
  });

  router.openapi(passwordPolicyRoute, async (c) => {
    return c.json(
      {
        minLength: 12,
        requireUpper: true,
        requireLower: true,
        requireDigit: true,
        requireSymbol: true,
        disallowCommon: true,
      },
      200
    );
  });

  // ── POST /auth/password/recover/request ───────────────────────────────
  router.use('/auth/password/recover/request', idempotency);

  const passwordRecoverRequestRoute = createRoute({
    method: 'post',
    path: '/auth/password/recover/request',
    operationId: 'passwordRecoverRequest',
    tags: ['auth'],
    security: [],
    request: {
      body: {
        content: { 'application/json': { schema: PasswordRecoverRequestSchema } },
      },
    },
    responses: {
      202: {
        description: 'Recovery email sent (always — no enumeration)',
      },
      400: commonErrorResponses[400],
      429: commonErrorResponses[429],
    },
  });

  router.openapi(passwordRecoverRequestRoute, async (c) => {
    const { email } = c.req.valid('json');
    const ipAddress = c.req.header('X-Forwarded-For') ?? c.req.header('X-Real-IP') ?? 'unknown';
    // Always returns 202 — no enumeration. Service handles user-exists check.
    // Errors are caught silently (rate limit 429 does propagate via error handler).
    // findByEmailGlobal is used in service — no tenantId needed.
    await passwordService.requestRecovery({ email, ipAddress });
    return new Response(null, { status: 202 });
  });

  // ── POST /auth/password/recover/complete ──────────────────────────────
  router.use('/auth/password/recover/complete', idempotency);

  const passwordRecoverCompleteRoute = createRoute({
    method: 'post',
    path: '/auth/password/recover/complete',
    operationId: 'passwordRecoverComplete',
    tags: ['auth'],
    security: [],
    request: {
      body: {
        content: { 'application/json': { schema: PasswordRecoverCompleteRequestSchema } },
      },
    },
    responses: {
      200: {
        description: 'Password recovered',
      },
      400: commonErrorResponses[400],
      410: commonErrorResponses[410],
      422: commonErrorResponses[422],
    },
  });

  router.openapi(passwordRecoverCompleteRoute, async (c) => {
    const { otpVerificationToken, password } = c.req.valid('json');
    await passwordService.completeRecovery({ otpVerificationToken, newPassword: password });
    return c.json({ ok: true }, 200);
  });

  // ── POST /auth/first-login/start ──────────────────────────────────────
  router.use('/auth/first-login/start', idempotency);

  const firstLoginStartRoute = createRoute({
    method: 'post',
    path: '/auth/first-login/start',
    operationId: 'firstLoginStart',
    tags: ['auth'],
    security: [],
    request: {
      body: {
        content: { 'application/json': { schema: FirstLoginStartRequestSchema } },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              otpId: z.string(),
              channel: z.string(),
              maskedDestination: z.string(),
              expiresAt: z.string(),
              resendAvailableAt: z.string(),
            }),
          },
        },
        description: 'OTP sent for first login',
      },
      400: commonErrorResponses[400],
      404: commonErrorResponses[404],
      409: commonErrorResponses[409],
    },
  });

  router.openapi(firstLoginStartRoute, async (c) => {
    const { email } = c.req.valid('json');
    const ipAddress = c.req.header('X-Forwarded-For') ?? c.req.header('X-Real-IP') ?? 'unknown';
    const result = await firstLoginService.start({ email, ipAddress });
    return c.json(
      {
        otpId: result.otpId,
        channel: result.channel,
        maskedDestination: result.maskedDestination,
        expiresAt: result.expiresAt.toISOString(),
        resendAvailableAt: result.resendAvailableAt.toISOString(),
      },
      200
    );
  });

  // ── POST /auth/first-login/set-password ───────────────────────────────
  router.use('/auth/first-login/set-password', idempotency);

  const firstLoginSetPasswordRoute = createRoute({
    method: 'post',
    path: '/auth/first-login/set-password',
    operationId: 'firstLoginSetPassword',
    tags: ['auth'],
    security: [],
    request: {
      body: {
        content: { 'application/json': { schema: FirstLoginSetPasswordRequestSchema } },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: SessionSchema } },
        description: 'Session issued after first login',
      },
      400: commonErrorResponses[400],
      410: commonErrorResponses[410],
      422: commonErrorResponses[422],
    },
  });

  router.openapi(firstLoginSetPasswordRoute, async (c) => {
    const body = c.req.valid('json');
    const { session, refreshTokenRaw } = await firstLoginService.setPassword({
      otpVerificationToken: body.otpVerificationToken,
      password: body.password,
    });
    setRefreshCookie(c, refreshTokenRaw, config);
    return c.json(session, 200);
  });

  // ── GET /auth/first-login/validate ──────────────────────────────────────
  // Public endpoint — no auth required. Validates an activation token.
  const validateActivationRoute = createRoute({
    method: 'get',
    path: '/auth/first-login/validate',
    operationId: 'validateActivationToken',
    tags: ['auth'],
    security: [],
    request: {
      query: ActivationTokenValidateQuerySchema,
    },
    responses: {
      200: {
        content: { 'application/json': { schema: ActivationTokenValidateResponseSchema } },
        description: 'Token validated — returns user info',
      },
      404: commonErrorResponses[404],
      410: commonErrorResponses[410],
    },
  });

  router.openapi(validateActivationRoute, async (c) => {
    const { token } = c.req.valid('query');
    const result = await firstLoginService.validateActivationToken(token);
    return c.json(result, 200);
  });

  // ── GET /auth/me ──────────────────────────────────────────────────────
  router.use('/auth/me', authGuard);

  const meRoute = createRoute({
    method: 'get',
    path: '/auth/me',
    operationId: 'getMe',
    tags: ['auth'],
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              user: UserSchema,
              tenant: TenantInSessionSchema,
              role: z.enum(['SuperAdmin', 'TenantAdmin', 'User']),
            }),
          },
        },
        description: 'Current session identity with full user and tenant details',
      },
      401: commonErrorResponses[401],
    },
  });

  router.openapi(meRoute, async (c) => {
    const me = await authService.me(c.var.user.sub);
    return c.json(
      {
        user: me.user,
        tenant: me.tenant,
        role: me.role,
      },
      200
    );
  });

  return router;
}
