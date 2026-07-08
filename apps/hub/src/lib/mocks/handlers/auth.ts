import { http, HttpResponse } from 'msw';

import { db } from '../db';
import { getActiveScenario } from '../scenarios/index';
import { SEED } from '../seed';
import { mintFakeJwt, stableFuture } from '../seed-utils';

import { idempotentResponse } from './idempotency-cache';
import { unauthorized, unprocessable } from './problem';

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

const REFRESH_COOKIE = `refresh_token=mock-refresh-token; HttpOnly; Path=/auth/refresh; SameSite=Lax; Max-Age=604800`;
const SESSION_COOKIE = `hub_session=1; Path=/; SameSite=Lax; Max-Age=604800`;
const CLEAR_SESSION_COOKIE = `hub_session=; Path=/; SameSite=Lax; Max-Age=0`;
const CLEAR_COOKIE = `refresh_token=; HttpOnly; Path=/auth/refresh; SameSite=Lax; Max-Age=0`;

function sessionHeaders(): Headers {
  const h = new Headers();
  h.append('Set-Cookie', REFRESH_COOKIE);
  h.append('Set-Cookie', SESSION_COOKIE);
  return h;
}

function clearSessionHeaders(): Headers {
  const h = new Headers();
  h.append('Set-Cookie', CLEAR_COOKIE);
  h.append('Set-Cookie', CLEAR_SESSION_COOKIE);
  return h;
}
const MOCK_OTP_CODE = '000000';
const MOCK_OTP_ID = 'otp-00000000-0000-0000-0000-000000000001';
const MOCK_OTP_VERIFICATION_TOKEN = 'mock-otp-verification-token';

function buildOtpId(otpId: string, channel = 'email'): Record<string, unknown> {
  return {
    otpId,
    channel,
    maskedDestination: 'a***@corehub.com',
    expiresAt: stableFuture(300),
    resendAvailableAt: stableFuture(30),
  };
}

function buildSession(userId: string): Record<string, unknown> {
  const user = db.user.findFirst({ where: { id: { equals: userId } } });
  const tenant =
    user?.tenantId !== null
      ? db.tenant.findFirst({ where: { id: { equals: user?.tenantId ?? '' } } })
      : null;

  const accessToken = mintFakeJwt({
    sub: userId,
    email: user?.email ?? '',
    name: user?.fullName ?? '',
    tenant_id: tenant?.slug ?? 'unknown',
    tenant_uuid: tenant?.id ?? '',
    tenant_slug: tenant?.slug ?? 'unknown',
    role: user?.role ?? 'User',
  });

  return {
    accessToken,
    expiresIn: 900,
    tokenType: 'Bearer',
    user: {
      id: user?.id ?? userId,
      email: user?.email ?? '',
      fullName: user?.fullName ?? '',
      picture: user?.picture ?? null,
      role: user?.role ?? 'User',
    },
    tenant:
      tenant !== null
        ? { id: tenant.id, slug: tenant.slug, name: tenant.name, planId: tenant.planId, status: tenant.status }
        : null,
    role: user?.role ?? 'User',
  };
}

export const authHandlers = [
  // POST /auth/otp/send
  http.post(`${BASE}/auth/otp/send`, async ({ request }) => {
    return idempotentResponse(request, 200, () => buildOtpId(MOCK_OTP_ID));
  }),

  // POST /auth/otp/verify
  http.post(`${BASE}/auth/otp/verify`, async ({ request }) => {
    const body = (await request.json()) as { otpId?: string; code?: string };
    const idemKey = request.headers.get('Idempotency-Key');
    const scenario = getActiveScenario();

    if (scenario === 'otp-failure') {
      return HttpResponse.json(
        {
          type: 'https://corehub.com/errors/validation',
          title: 'Validation failed',
          status: 422,
          code: 'otp_invalid',
          detail: 'Código OTP inválido',
          attemptsRemaining: 4,
        } as Record<string, unknown>,
        { status: 422, headers: { 'Content-Type': 'application/problem+json' } },
      );
    }

    if (body.code !== MOCK_OTP_CODE) {
      return HttpResponse.json(
        {
          type: 'https://corehub.com/errors/validation',
          title: 'Validation failed',
          status: 422,
          code: 'otp_invalid',
          detail: 'Código OTP inválido',
          attemptsRemaining: 4,
        } as Record<string, unknown>,
        { status: 422, headers: { 'Content-Type': 'application/problem+json' } },
      );
    }

    const syntheticRequest = new Request(request.url, {
      headers: idemKey !== null ? { 'Idempotency-Key': idemKey } : {},
    });

    return idempotentResponse(syntheticRequest, 200, () => ({
      otpVerificationToken: MOCK_OTP_VERIFICATION_TOKEN,
      expiresAt: stableFuture(300),
    }));
  }),

  // POST /auth/login
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string; deviceId?: string };
    const user = db.user.findFirst({ where: { email: { equals: body.email ?? '' } } });

    if (user === null) {
      return unauthorized('Invalid credentials');
    }

    // Scenario: trusted-device bypass (deviceId present and scenario is 'device-trusted')
    const scenario = getActiveScenario();
    if (scenario === 'device-trusted' && body.deviceId) {
      return HttpResponse.json(
        {
          otpRequired: false,
          session: buildSession(user.id),
        } as Record<string, unknown>,
        { headers: sessionHeaders() }
      );
    }

    db.otp.create({
      id: MOCK_OTP_ID,
      userId: user.id,
      code: MOCK_OTP_CODE,
      expiresAt: Date.now() + 300_000,
      attempts: 0,
      used: false,
      purpose: 'login',
    });

    return HttpResponse.json({
      otpRequired: true,
      otpId: MOCK_OTP_ID,
      channel: 'email',
      maskedDestination: 'a***@corehub.com',
      expiresAt: stableFuture(300),
      resendAvailableAt: stableFuture(30),
      session: null,
    } as Record<string, unknown>);
  }),

  // POST /auth/login/complete
  http.post(`${BASE}/auth/login/complete`, async ({ request }) => {
    const scenario = getActiveScenario();
    if (scenario === 'otp-failure') {
      return unprocessable('Código OTP inválido', [
        { field: 'code', code: 'otp_invalid', message: 'Código OTP inválido' },
      ]);
    }
    return idempotentResponse(request, 200, () => buildSession(SEED.userId), sessionHeaders());
  }),

  // POST /auth/refresh
  http.post(`${BASE}/auth/refresh`, () => {
    const scenario = getActiveScenario();
    if (scenario === 'session-expired') {
      return HttpResponse.json(
        {
          type: 'https://corehub.com/errors/unauthorized',
          title: 'Refresh token expired',
          status: 401,
          detail: 'Refresh token expired',
        } as Record<string, unknown>,
        {
          status: 401,
          headers: clearSessionHeaders(),
        },
      );
    }

    const user = db.user.findFirst({ where: { id: { equals: SEED.userId } } });
    const accessToken = mintFakeJwt({
      sub: SEED.userId,
      email: user?.email ?? '',
      name: user?.fullName ?? '',
      tenant_id: SEED.tenantSlug,
      tenant_uuid: SEED.tenantId,
      tenant_slug: SEED.tenantSlug,
      role: 'TenantAdmin',
    });

    return HttpResponse.json(
      { accessToken, expiresIn: 900 } as Record<string, unknown>,
      { headers: sessionHeaders() },
    );
  }),

  // POST /auth/logout
  http.post(`${BASE}/auth/logout`, () => {
    return new HttpResponse(null, {
      status: 204,
      headers: clearSessionHeaders(),
    });
  }),

  // POST /auth/first-login/start
  http.post(`${BASE}/auth/first-login/start`, async ({ request }) => {
    return idempotentResponse(request, 200, () => buildOtpId(MOCK_OTP_ID));
  }),

  // POST /auth/first-login/set-password
  http.post(`${BASE}/auth/first-login/set-password`, async ({ request }) => {
    return idempotentResponse(request, 200, () => buildSession(SEED.userId), sessionHeaders());
  }),

  // GET /auth/password/policy
  http.get(`${BASE}/auth/password/policy`, () => {
    return HttpResponse.json({
      minLength: 12,
      requireUpper: true,
      requireLower: true,
      requireDigit: true,
      requireSymbol: true,
      disallowCommon: true,
    } as Record<string, unknown>);
  }),

  // POST /auth/password/recover/request — anti-enumeration: always 202
  http.post(`${BASE}/auth/password/recover/request`, () => {
    return new HttpResponse(null, { status: 202 });
  }),

  // POST /auth/password/recover/complete
  http.post(`${BASE}/auth/password/recover/complete`, () => {
    return new HttpResponse(null, { status: 200 });
  }),

  // GET /auth/me
  http.get(`${BASE}/auth/me`, () => {
    const user = db.user.findFirst({ where: { id: { equals: SEED.userId } } });
    if (user === null) {
      return unauthorized();
    }
    const tenant =
      user.tenantId !== null
        ? db.tenant.findFirst({ where: { id: { equals: user.tenantId } } })
        : null;

    return HttpResponse.json({
      user: { id: user.id, email: user.email, fullName: user.fullName, picture: user.picture ?? null },
      tenant:
        tenant !== null
          ? { id: tenant.id, slug: tenant.slug, name: tenant.name, planId: tenant.planId, status: tenant.status }
          : null,
      role: user.role,
    } as Record<string, unknown>);
  }),

  // GET /auth/first-login/validate
  http.get(`${BASE}/auth/first-login/validate`, ({ request }) => {
    const url = new URL(request.url);
    const token = url.searchParams.get('token') ?? '';
    const tenant = db.tenant.findFirst({ where: { id: { equals: SEED.tenantId } } });
    const user = db.user.findFirst({ where: { id: { equals: SEED.userId } } });

    if (token === 'valid-activation-token') {
      return HttpResponse.json({
        email: user?.email ?? 'test@corehub.com',
        fullName: user?.fullName ?? 'Test User',
        tenantName: tenant?.name ?? 'Test Tenant',
      } as Record<string, unknown>);
    }

    return HttpResponse.json(
      {
        type: 'https://corehub.com/errors/auth/token_not_found',
        title: 'No encontrado',
        status: 404,
        code: 'auth.token_not_found',
      } as Record<string, unknown>,
      { status: 404, headers: { 'Content-Type': 'application/problem+json' } },
    );
  }),
];
