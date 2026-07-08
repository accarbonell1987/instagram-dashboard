/**
 * Integration smoke tests: apiFetch (our real client) hitting MSW Node server.
 * The server is started globally in vitest.setup.ts.
 * These tests verify that the full stack (apiFetch → MSW handlers → db) works end-to-end.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { seedDb, applyScenario } from './seed';

import { apiFetch } from '@/lib/api/client';

// apiFetch uses NEXT_PUBLIC_API_URL which defaults to http://localhost:8080
// MSW Node server intercepts at that URL — no real network needed.

describe('MSW integration', () => {
  beforeEach(() => {
    applyScenario('happy');
  });

  it('GET /auth/password/policy returns expected shape via apiFetch', async () => {
    const policy = await apiFetch<{
      minLength: number;
      requireUpper: boolean;
      requireSymbol: boolean;
    }>('/auth/password/policy');

    expect(policy.minLength).toBe(12);
    expect(policy.requireUpper).toBe(true);
    expect(policy.requireSymbol).toBe(true);
  });

  it('GET /plans returns 3 plans via apiFetch', async () => {
    const result = await apiFetch<{ plans: unknown[] }>('/plans');
    expect(Array.isArray(result.plans)).toBe(true);
    expect(result.plans).toHaveLength(3);
  });

  it('full login flow: POST /auth/login → /auth/otp/verify → /auth/login/complete', async () => {
    seedDb('happy');

    // Step 1: login
    const loginResult = await apiFetch<{
      otpRequired: boolean;
      otpId: string;
    }>('/auth/login', {
      method: 'POST',
      body: { email: 'test@corehub.com', password: 'Pass1234!' },
    });

    expect(loginResult.otpRequired).toBe(true);
    expect(typeof loginResult.otpId).toBe('string');

    // Step 2: verify OTP
    const verifyResult = await apiFetch<{
      otpVerificationToken: string;
      expiresAt: string;
    }>('/auth/otp/verify', {
      method: 'POST',
      idempotencyKey: '550e8400-idem-0000-0000-000000000030',
      body: { otpId: loginResult.otpId, code: '000000' },
    });

    expect(typeof verifyResult.otpVerificationToken).toBe('string');

    // Step 3: login complete
    const sessionResult = await apiFetch<{
      accessToken: string;
      expiresIn: number;
      user: { email: string };
    }>('/auth/login/complete', {
      method: 'POST',
      idempotencyKey: '550e8400-idem-0000-0000-000000000031',
      body: { otpId: loginResult.otpId, code: '000000' },
    });

    expect(typeof sessionResult.accessToken).toBe('string');
    expect(sessionResult.expiresIn).toBe(900);
    expect(sessionResult.user.email).toBe('test@corehub.com');
  });

  it('idempotency: two POSTs with same key return same response (draft creation)', async () => {
    seedDb('happy');
    const idemKey = '550e8400-idem-0000-0000-000000000040';

    const first = await apiFetch<{ id: string }>('/onboarding/draft', {
      method: 'POST',
      idempotencyKey: idemKey,
      body: { planId: 'professional' },
    });

    const second = await apiFetch<{ id: string }>('/onboarding/draft', {
      method: 'POST',
      idempotencyKey: idemKey,
      body: { planId: 'professional' },
    });

    expect(first.id).toBe(second.id);
  });
});
