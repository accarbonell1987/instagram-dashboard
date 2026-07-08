import { http, HttpResponse } from 'msw';
import { describe, it, expect, beforeEach } from 'vitest';

import {
  login,
  verifyOtp,
  completeLogin,
  getPasswordPolicy,
  sendOtp,
  firstLoginStart,
  validateFirstLoginToken,
} from './auth.service';

import { ValidationError, AuthError } from '@/lib/api/errors';
import { mintFakeJwt } from '@/lib/mocks/seed-utils';
import { server } from '@/lib/mocks/server';
import { applyScenario } from '@/lib/mocks/seed';
import { getSessionState, setSessionState } from '@/modules/iam/identity/session/store';

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

beforeEach(() => {
  applyScenario('happy');
  setSessionState({ status: 'unauthenticated', session: null });
});

describe('login', () => {
  it('returns otpRequired=true and otpId for valid credentials (no device trust)', async () => {
    const result = await login({ email: 'test@corehub.com', password: 'any' });
    expect(result.otpRequired).toBe(true);
    if (result.otpRequired) {
      expect(typeof result.otpId).toBe('string');
      expect(result.otpId.length).toBeGreaterThan(0);
    }
  });

  it('returns otpChannel correctly', async () => {
    const result = await login({ email: 'test@corehub.com', password: 'any' });
    expect(result.otpRequired).toBe(true);
    if (result.otpRequired) {
      expect(result.otpChannel).toBe('email');
    }
  });

  it('throws for unknown email', async () => {
    await expect(login({ email: 'notexist@example.com', password: 'any' })).rejects.toThrow();
  });

  it('throws AuthError for 401 response', async () => {
    server.use(
      http.post(`${BASE}/auth/login`, () =>
        HttpResponse.json(
          { type: 'https://corehub.com/errors/auth', title: 'Unauthorized', status: 401 },
          { status: 401, headers: { 'Content-Type': 'application/problem+json' } }
        )
      )
    );

    await expect(login({ email: 'test@corehub.com', password: 'wrong' })).rejects.toBeInstanceOf(
      AuthError
    );
  });

  it('returns otpRequired=false and sets session for trusted device', async () => {
    const fakeSession = {
      accessToken: mintFakeJwt({
        sub: 'user-0001',
        email: 'test@corehub.com',
        name: 'Ana Pereira',
        tenant_id: 'acme',
        role: 'TenantAdmin',
      }),
      expiresIn: 900,
      tokenType: 'Bearer',
      user: { id: 'user-0001', email: 'test@corehub.com', fullName: 'Ana Pereira', picture: null, role: 'TenantAdmin' },
      tenant: { id: 'tenant-001', slug: 'acme', name: 'Acme S.A.', planId: 'professional', status: 'active' },
      role: 'TenantAdmin',
    };

    server.use(
      http.post(`${BASE}/auth/login`, () =>
        HttpResponse.json({ otpRequired: false, session: fakeSession })
      )
    );

    const result = await login({ email: 'test@corehub.com', password: 'any' });
    expect(result.otpRequired).toBe(false);
    expect(getSessionState().status).toBe('authenticated');
  });

  it('does NOT set session when otpRequired=true even if session field is present', async () => {
    // Defensive: backend might return a session alongside otpRequired=true.
    // The login function must NOT apply the session in this case.
    const fakeSession = {
      accessToken: mintFakeJwt({
        sub: 'user-0001', email: 'test@corehub.com', name: 'A', tenant_id: 'acme', role: 'TenantAdmin',
      }),
      expiresIn: 900,
      tokenType: 'Bearer',
      user: { id: 'user-0001', email: 'test@corehub.com', fullName: 'A', picture: null, role: 'TenantAdmin' },
      tenant: { id: 'tenant-001', slug: 'acme', name: 'A', planId: 'professional', status: 'active' },
      role: 'TenantAdmin',
    };

    server.use(
      http.post(`${BASE}/auth/login`, () =>
        HttpResponse.json({ otpRequired: true, otpId: 'otp-test', channel: 'email', session: fakeSession })
      )
    );

    const result = await login({ email: 'test@corehub.com', password: 'any' });
    expect(result.otpRequired).toBe(true);
    // Session must NOT have been applied — stays unauthenticated
    expect(getSessionState().status).toBe('unauthenticated');
  });
});

describe('sendOtp', () => {
  it('returns otpId and expiresInSeconds', async () => {
    const result = await sendOtp({
      channel: 'email',
      purpose: 'login',
      identifier: 'test@corehub.com',
    });
    expect(typeof result.otpId).toBe('string');
    expect(typeof result.expiresInSeconds).toBe('number');
  });
});

describe('verifyOtp', () => {
  it('happy path returns verificationToken', async () => {
    const result = await verifyOtp({
      otpId: 'otp-00000000-0000-0000-0000-000000000001',
      code: '000000',
    });
    expect(typeof result.verificationToken).toBe('string');
    expect(result.verificationToken.length).toBeGreaterThan(0);
  });

  it('otp-failure scenario throws ValidationError', async () => {
    applyScenario('otp-failure');
    await expect(
      verifyOtp({ otpId: 'otp-00000000-0000-0000-0000-000000000001', code: '999999' })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('completeLogin', () => {
  it('happy path returns session and updates sessionState', async () => {
    const session = await completeLogin({
      otpId: 'otp-00000000-0000-0000-0000-000000000001',
      code: '000000',
    });
    expect(typeof session.accessToken).toBe('string');
    expect(getSessionState().status).toBe('authenticated');
    expect(getSessionState().session).not.toBeNull();
  });
});

describe('getPasswordPolicy', () => {
  it('returns expected shape', async () => {
    const policy = await getPasswordPolicy();
    expect(typeof policy.minLength).toBe('number');
    expect(typeof policy.requireUpper).toBe('boolean');
    expect(typeof policy.requireLower).toBe('boolean');
    expect(typeof policy.requireDigit).toBe('boolean');
    expect(typeof policy.requireSymbol).toBe('boolean');
    expect(typeof policy.disallowCommon).toBe('boolean');
  });
});

describe('firstLoginStart', () => {
  it('returns otpId', async () => {
    const result = await firstLoginStart({ email: 'test@corehub.com' });
    expect(typeof result.otpId).toBe('string');
  });
});

describe('validateFirstLoginToken', () => {
  it('returns { email, fullName, tenantName } for a valid token', async () => {
    const result = await validateFirstLoginToken('valid-activation-token');
    expect(result.email).toBe('test@corehub.com');
    expect(typeof result.fullName).toBe('string');
    expect(typeof result.tenantName).toBe('string');
  });

  it('throws for an unknown token', async () => {
    await expect(validateFirstLoginToken('unknown-token')).rejects.toThrow();
  });
});
