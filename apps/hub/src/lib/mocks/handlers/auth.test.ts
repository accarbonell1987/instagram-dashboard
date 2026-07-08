/**
 * Auth handlers test.
 * Uses the global MSW Node server started in vitest.setup.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { seedDb, applyScenario } from '../seed';

const BASE = 'http://localhost:8080';

describe('auth handlers', () => {
  beforeEach(() => {
    seedDb('happy');
  });

  it('GET /auth/password/policy returns expected shape', async () => {
    const response = await fetch(`${BASE}/auth/password/policy`);
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body['minLength']).toBe(12);
    expect(body['requireUpper']).toBe(true);
    expect(body['requireSymbol']).toBe(true);
  });

  it('POST /auth/login with valid email returns otpRequired: true', async () => {
    const response = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@corehub.com', password: 'Pass1234!' }),
    });
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body['otpRequired']).toBe(true);
    expect(typeof body['otpId']).toBe('string');
  });

  it('POST /auth/login with unknown email returns 401', async () => {
    const response = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unknown@example.com', password: 'wrong' }),
    });
    expect(response.status).toBe(401);
    const contentType = response.headers.get('content-type') ?? '';
    expect(contentType).toContain('application/problem+json');
  });

  it('POST /auth/otp/verify with otp-failure scenario returns 422 + application/problem+json', async () => {
    applyScenario('otp-failure');
    const response = await fetch(`${BASE}/auth/otp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': '550e8400-e29b-41d4-a716-446655440099',
      },
      body: JSON.stringify({ otpId: 'some-id', code: '000000' }),
    });
    expect(response.status).toBe(422);
    const contentType = response.headers.get('content-type') ?? '';
    expect(contentType).toContain('application/problem+json');
    const body = await response.json() as Record<string, unknown>;
    expect(body['code']).toBe('otp_invalid');
    expect(typeof body['attemptsRemaining']).toBe('number');
  });

  it('POST /auth/refresh with session-expired scenario returns 401', async () => {
    applyScenario('session-expired');
    const response = await fetch(`${BASE}/auth/refresh`, { method: 'POST' });
    expect(response.status).toBe(401);
  });

  it('POST /auth/refresh happy returns 200 with accessToken', async () => {
    const response = await fetch(`${BASE}/auth/refresh`, { method: 'POST' });
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(typeof body['accessToken']).toBe('string');
    expect(body['expiresIn']).toBe(900);
  });

  it('POST /auth/logout returns 204', async () => {
    const response = await fetch(`${BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Idempotency-Key': '550e8400-e29b-41d4-a716-446655440001' },
    });
    expect(response.status).toBe(204);
  });

  it('POST /auth/password/recover/request always returns 202 (anti-enumeration)', async () => {
    const response = await fetch(`${BASE}/auth/password/recover/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': '550e8400-e29b-41d4-a716-446655440002',
      },
      body: JSON.stringify({ email: 'nobody@example.com' }),
    });
    expect(response.status).toBe(202);
  });

  it('POST /auth/login/complete happy returns full session', async () => {
    const response = await fetch(`${BASE}/auth/login/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': '550e8400-e29b-41d4-a716-446655440003',
      },
      body: JSON.stringify({ otpId: 'mock-otp-id', code: '000000' }),
    });
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(typeof body['accessToken']).toBe('string');
    expect(body['expiresIn']).toBe(900);
    expect(body['user']).toBeDefined();
  });
});
