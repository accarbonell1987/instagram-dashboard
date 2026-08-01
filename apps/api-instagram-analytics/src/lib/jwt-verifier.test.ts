import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedError } from '../errors.js';

// c2 (8.2/8.3, PR9): optional product_roles claim parsing — see design
// "Per-Product Roles / JWT" and owner decision #1679/2. Mock jose so
// verifyAccessToken's own claim-mapping logic is exercised directly,
// without a real network JWKS fetch.
vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => vi.fn()),
  jwtVerify: vi.fn(),
}));

import { jwtVerify } from 'jose';
import { verifyAccessToken } from './jwt-verifier.js';

function mockPayload(overrides: Record<string, unknown> = {}) {
  return {
    sub: 'user-1',
    tenant_id: 'acme',
    tenant_uuid: 'uuid-1',
    tenant_slug: 'acme',
    role: 'User',
    jti: 'jti-1',
    kid: 'kid-1',
    ...overrides,
  };
}

describe('verifyAccessToken', () => {
  beforeEach(() => {
    vi.mocked(jwtVerify).mockReset();
  });

  it('returns a TenantContext without productRoles when the claim is absent (old tokens still verify)', async () => {
    vi.mocked(jwtVerify).mockResolvedValue({ payload: mockPayload() } as never);

    const tenant = await verifyAccessToken('token');

    expect(tenant).toEqual({
      userId: 'user-1',
      tenantId: 'uuid-1',
      tenantSlug: 'acme',
      role: 'User',
    });
    expect(tenant).not.toHaveProperty('productRoles');
  });

  it('parses the optional product_roles claim into TenantContext.productRoles', async () => {
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: mockPayload({ product_roles: { 'instagram-dashboard': ['analyst', 'editor'] } }),
    } as never);

    const tenant = await verifyAccessToken('token');

    expect(tenant.productRoles).toEqual({ 'instagram-dashboard': ['analyst', 'editor'] });
    // the global role claim stays intact, layered underneath
    expect(tenant.role).toBe('User');
  });

  it('still throws UnauthorizedError on an expired token, unaffected by the new claim', async () => {
    const error = new Error('expired');
    error.name = 'JWTExpired';
    vi.mocked(jwtVerify).mockRejectedValue(error);

    await expect(verifyAccessToken('token')).rejects.toThrow(UnauthorizedError);
  });
});
