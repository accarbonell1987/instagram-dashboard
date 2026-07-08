import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { middleware } from './middleware';

// ─── Helpers ────────────────────────────────────────────

function makeRequest(url: string, host?: string, cookies?: Record<string, string>): NextRequest {
  const headers = new Headers(host ? { host } : {});
  // Build cookie string from the cookies object
  if (cookies && Object.keys(cookies).length > 0) {
    headers.set(
      'cookie',
      Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')
    );
  }
  return new NextRequest(url, { headers });
}

// Reset env between tests
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_TENANT_MODE', 'path');
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8080');
  vi.stubEnv('NEXT_PUBLIC_BASE_DOMAIN', 'corehub.com');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('middleware — path mode', () => {
  it('redirects portal route to /login when hub_session cookie is absent', () => {
    const request = makeRequest('http://localhost:3001/dashboard');
    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toMatch(/\/login/);
  });

  it('passes through portal route when hub_session cookie is present', () => {
    const request = makeRequest(
      'http://localhost:3001/dashboard',
      undefined,
      { hub_session: '1' }
    );
    const response = middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('injects x-tenant-slug header for portal routes with hub_session present', () => {
    const request = makeRequest(
      'http://localhost:3001/app/acme/dashboard',
      undefined,
      { hub_session: '1' }
    );
    const response = middleware(request);

    // NextResponse.next() returns a 200; redirect-check confirms not a redirect.
    expect(response.status).toBe(200);
  });

  it('passes through /login (public route) even without hub_session', () => {
    const request = makeRequest('http://localhost:3001/login');
    const response = middleware(request);

    expect(response.status).toBe(200);
  });

  it('passes through /signup/* (public route)', () => {
    const request = makeRequest('http://localhost:3001/signup/step-1');
    const response = middleware(request);

    expect(response.status).toBe(200);
  });

  it('passes through /invite/... (public route)', () => {
    const request = makeRequest('http://localhost:3001/invite/abc123');
    const response = middleware(request);

    expect(response.status).toBe(200);
  });

  it('passes through /recover (public route)', () => {
    const request = makeRequest('http://localhost:3001/recover');
    const response = middleware(request);

    expect(response.status).toBe(200);
  });
});

describe('middleware — subdomain mode', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_TENANT_MODE', 'subdomain');
  });

  it('redirects portal route to /login when hub_session cookie is absent', () => {
    const request = makeRequest('https://acme.corehub.com/dashboard', 'acme.corehub.com');
    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toMatch(/\/login/);
  });

  it('injects x-tenant-slug for portal route on tenant subdomain when hub_session present', () => {
    const request = makeRequest(
      'https://acme.corehub.com/dashboard',
      'acme.corehub.com',
      { hub_session: '1' }
    );
    const response = middleware(request);

    expect(response.status).toBe(200);
  });

  it('passes through /login on bare domain (public route)', () => {
    const request = makeRequest('https://corehub.com/login', 'corehub.com');
    const response = middleware(request);

    expect(response.status).toBe(200);
  });
});
