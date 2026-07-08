/**
 * Integration tests for the disconnect route.
 *
 * POST /api/auth/instagram/disconnect
 * - 200: valid JWT + active account → success envelope
 * - 401: missing JWT → unauthorized
 * - 404: valid JWT + no active account → not found
 *
 * The route is defined inline in index.ts on the protected `api` sub-app.
 * We build a minimal Hono app that reproduces the same wiring:
 *   api.use('*', authGuard) → api.post('/auth/instagram/disconnect', ...)
 * to test it in isolation without starting the full server.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock jwt-verifier so authGuard works without a real JWKS endpoint
vi.mock('../../lib/jwt-verifier.js', () => ({
  verifyAccessToken: vi.fn(),
}));

import { verifyAccessToken } from '../../lib/jwt-verifier.js';
import { authGuard } from '../../middleware/auth-guard.js';
import { errorHandler } from '../../middleware/error-handler.js';
import { NotFoundError } from '../../errors.js';
import type { OAuthService } from '../../services/oauth.service.js';

const MOCK_TENANT = {
  userId: 'user-uuid-123',
  tenantId: 'tenant-uuid-456',
  tenantSlug: 'test-tenant',
  role: 'User',
} as const;

/** Creates a minimal Hono app wired identically to the disconnect handler in index.ts */
function createTestApp(oauthService: Pick<OAuthService, 'disconnectAccount'>) {
  const app = new Hono();
  const api = new Hono();

  api.use('*', authGuard);
  api.post('/auth/instagram/disconnect', async (c) => {
    const tenant = c.get('tenant');
    await oauthService.disconnectAccount(tenant.tenantId, tenant.userId);
    return c.json({ success: true, data: { message: 'Cuenta desconectada exitosamente' } }, 200);
  });

  app.route('/api', api);
  app.onError(errorHandler);

  return app;
}

describe('POST /api/auth/instagram/disconnect', () => {
  let mockOAuthService: { disconnectAccount: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOAuthService = { disconnectAccount: vi.fn() };
  });

  it('returns 200 with success envelope when account is disconnected', async () => {
    vi.mocked(verifyAccessToken).mockResolvedValue(MOCK_TENANT);
    mockOAuthService.disconnectAccount.mockResolvedValue(undefined);

    const app = createTestApp(mockOAuthService as unknown as OAuthService);
    const req = new Request('http://localhost/api/auth/instagram/disconnect', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
    });

    const res = await app.fetch(req);
    const body = (await res.json()) as { success: boolean; data: { message: string } };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.message).toBe('Cuenta desconectada exitosamente');
    expect(mockOAuthService.disconnectAccount).toHaveBeenCalledWith(
      MOCK_TENANT.tenantId,
      MOCK_TENANT.userId,
    );
  });

  it('returns 401 when no JWT is provided', async () => {
    const app = createTestApp(mockOAuthService as unknown as OAuthService);
    const req = new Request('http://localhost/api/auth/instagram/disconnect', {
      method: 'POST',
    });

    const res = await app.fetch(req);
    const body = (await res.json()) as { success: boolean; error: { code: string } };

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(mockOAuthService.disconnectAccount).not.toHaveBeenCalled();
  });

  it('returns 404 when no active account exists for the user', async () => {
    vi.mocked(verifyAccessToken).mockResolvedValue(MOCK_TENANT);
    mockOAuthService.disconnectAccount.mockRejectedValue(
      new NotFoundError('InstagramAccount', 'no-active-account'),
    );

    const app = createTestApp(mockOAuthService as unknown as OAuthService);
    const req = new Request('http://localhost/api/auth/instagram/disconnect', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
    });

    const res = await app.fetch(req);
    const body = (await res.json()) as { success: boolean; error: { code: string; message: string } };

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
