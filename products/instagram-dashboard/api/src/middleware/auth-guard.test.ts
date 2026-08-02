import { describe, it, expect, vi, beforeEach } from 'vitest';

import { UnauthorizedError } from '../errors.js';
import { verifyAccessToken } from '../lib/jwt-verifier.js';

import { authGuard } from './auth-guard.js';

// Mock jwt-verifier (vi.mock is hoisted above the imports at runtime)
vi.mock('../lib/jwt-verifier.js', () => ({
  verifyAccessToken: vi.fn(),
}));

type AuthGuardContext = Parameters<typeof authGuard>[0];

function createMockContext(header?: string): AuthGuardContext {
  return {
    req: { header: vi.fn(() => header) },
    set: vi.fn(),
    get: vi.fn(),
    var: {},
  } as unknown as AuthGuardContext;
}

describe('authGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws UnauthorizedError when no Authorization header present', async () => {
    const c = createMockContext(undefined);
    const next = vi.fn();

    await expect(authGuard(c, next)).rejects.toThrow(UnauthorizedError);
    expect(next).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedError when header lacks Bearer prefix', async () => {
    const c = createMockContext('Basic abc123');
    const next = vi.fn();

    await expect(authGuard(c, next)).rejects.toThrow(UnauthorizedError);
    expect(next).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedError when Authorization header is empty', async () => {
    const c = createMockContext('');
    const next = vi.fn();

    await expect(authGuard(c, next)).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError for malformed Bearer token', async () => {
    // Bearer with no token string
    const c = createMockContext('Bearer ');
    const next = vi.fn();
    vi.mocked(verifyAccessToken).mockRejectedValue(new UnauthorizedError('Invalid token'));

    await expect(authGuard(c, next)).rejects.toThrow(UnauthorizedError);
  });

  it('extracts token correctly from Bearer header', async () => {
    const mockTenant = {
      userId: 'user-1',
      tenantId: 'tenant-uuid',
      tenantSlug: 'test',
      role: 'User',
    };
    vi.mocked(verifyAccessToken).mockResolvedValue(mockTenant);

    const c = createMockContext('Bearer valid-token-abc123');
    const next = vi.fn();

    await authGuard(c, next);

    expect(verifyAccessToken).toHaveBeenCalledWith('valid-token-abc123');
  });

  it('sets tenant context on successful verification', async () => {
    const mockTenant = {
      userId: 'user-1',
      tenantId: 'tenant-uuid',
      tenantSlug: 'test',
      role: 'User',
    };
    vi.mocked(verifyAccessToken).mockResolvedValue(mockTenant);

    const c = createMockContext('Bearer valid-token');
    const next = vi.fn();

    await authGuard(c, next);

    expect(c.set).toHaveBeenCalledWith('tenant', mockTenant);
    expect(next).toHaveBeenCalled();
  });

  it('propagates verification errors as UnauthorizedError', async () => {
    vi.mocked(verifyAccessToken).mockRejectedValue(
      new UnauthorizedError('Token has expired'),
    );

    const c = createMockContext('Bearer expired-token');
    const next = vi.fn();

    await expect(authGuard(c, next)).rejects.toThrow('Token has expired');
    expect(c.set).not.toHaveBeenCalled();
  });

  it('does not call next if verification fails', async () => {
    vi.mocked(verifyAccessToken).mockRejectedValue(
      new Error('Network error'),
    );

    const c = createMockContext('Bearer bad-token');
    const next = vi.fn();

    await expect(authGuard(c, next)).rejects.toThrow();
    expect(next).not.toHaveBeenCalled();
  });
});
