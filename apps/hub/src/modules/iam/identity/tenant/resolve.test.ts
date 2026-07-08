import { describe, expect, it } from 'vitest';

import { resolveTenantFromHost, resolveTenantFromPath } from './resolve';

describe('resolveTenantFromHost — subdomain mode', () => {
  const mode = 'subdomain';
  const base = 'corehub.com';

  it('extracts slug from a single-label subdomain', () => {
    expect(resolveTenantFromHost('acme.corehub.com', mode, base)).toBe('acme');
  });

  it('returns null for the bare baseDomain (no subdomain)', () => {
    expect(resolveTenantFromHost('corehub.com', mode, base)).toBeNull();
  });

  it('returns null for www', () => {
    expect(resolveTenantFromHost('www.corehub.com', mode, base)).toBeNull();
  });

  it('returns null for multi-level subdomains', () => {
    expect(resolveTenantFromHost('a.acme.corehub.com', mode, base)).toBeNull();
  });

  it('returns null for unrelated hosts', () => {
    expect(resolveTenantFromHost('other.com', mode, base)).toBeNull();
  });

  it('returns null in path mode', () => {
    expect(resolveTenantFromHost('acme.corehub.com', 'path', base)).toBeNull();
  });
});

describe('resolveTenantFromPath', () => {
  it('extracts slug and rest from /app/{slug}/...', () => {
    expect(resolveTenantFromPath('/app/acme/dashboard')).toEqual({ slug: 'acme', rest: '/dashboard' });
  });

  it('extracts slug with trailing slash only', () => {
    expect(resolveTenantFromPath('/app/acme/')).toEqual({ slug: 'acme', rest: '/' });
  });

  it('extracts slug with no trailing path', () => {
    expect(resolveTenantFromPath('/app/acme')).toEqual({ slug: 'acme', rest: '/' });
  });

  it('returns null slug for /login', () => {
    expect(resolveTenantFromPath('/login')).toEqual({ slug: null, rest: '/login' });
  });

  it('returns null slug for root path', () => {
    expect(resolveTenantFromPath('/')).toEqual({ slug: null, rest: '/' });
  });

  it('returns null slug for arbitrary path not matching /app/', () => {
    expect(resolveTenantFromPath('/signup/step-1')).toEqual({ slug: null, rest: '/signup/step-1' });
  });
});
