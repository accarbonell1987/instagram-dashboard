import { OpenAPIHono } from '@hono/zod-openapi';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { NotFoundError } from '../../../errors.js';
import { errorHandler } from '../../../middleware/error-handler.js';
import type { TenantContext } from '../../../shared/lib/jwt-verifier.js';
import type { InstagramRepository } from '../../repositories/instagram/index.js';

import { createAdminRoutes } from './admin.routes.js';


// ─── Fixtures ────────────────────────────────────────────────────────────────

const ACCOUNT = {
  id: '11111111-1111-4111-8111-111111111111',
  tenantId: 'tenant-1',
  userId: '22222222-2222-4222-8222-222222222222',
  igUserId: '17841400000000000',
  username: 'miempresa',
  displayName: 'Mi Empresa',
  profilePictureUrl: null,
  followersCount: 4210,
  mediaCount: 88,
  accountType: 'BUSINESS',
  syncStatus: 'idle',
  lastSyncAt: new Date('2026-08-10T12:00:00.000Z'),
  connectedAt: new Date('2026-07-01T09:00:00.000Z'),
  tokenExpiresAt: new Date('2026-10-01T09:00:00.000Z'),
};

const mockRepository = {
  listAccountsByTenantId: vi.fn(),
  disconnectAccountById: vi.fn(),
};

/** Stands in for authGuard, which sets the verified claims on the context. */
function makeApp(role: string) {
  const app = new OpenAPIHono();
  app.use('*', async (c, next) => {
    c.set('tenant', {
      userId: '22222222-2222-4222-8222-222222222222',
      tenantId: 'tenant-1',
      role,
    } as TenantContext);
    await next();
  });
  app.route('/admin', createAdminRoutes(mockRepository as unknown as InstagramRepository));
  app.onError(errorHandler);
  return app;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Admin linked-account routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /admin/linked-accounts', () => {
    it('lists every account the tenant holds, with the user who holds it', async () => {
      mockRepository.listAccountsByTenantId.mockResolvedValueOnce([ACCOUNT]);

      const response = await makeApp('TenantAdmin').request('/admin/linked-accounts');
      const body = (await response.json()) as { accounts: Record<string, unknown>[] };

      expect(response.status).toBe(200);
      expect(mockRepository.listAccountsByTenantId).toHaveBeenCalledWith('tenant-1');
      expect(body.accounts[0]).toMatchObject({
        id: ACCOUNT.id,
        userId: ACCOUNT.userId,
        username: 'miempresa',
        syncStatus: 'idle',
      });
    });

    it('says so plainly when nothing is connected', async () => {
      mockRepository.listAccountsByTenantId.mockResolvedValueOnce([]);

      const response = await makeApp('TenantAdmin').request('/admin/linked-accounts');
      const body = (await response.json()) as { accounts: unknown[] };

      expect(response.status).toBe(200);
      expect(body.accounts).toEqual([]);
    });

    /**
     * The hub only decides which nav entry it draws — it is not in the request
     * path. Anyone with a valid token can call this URL directly, so the role
     * check has to live here or it does not exist.
     */
    it('refuses a plain User even though the hub would hide the entry', async () => {
      const response = await makeApp('User').request('/admin/linked-accounts');

      expect(response.status).toBe(403);
      expect(mockRepository.listAccountsByTenantId).not.toHaveBeenCalled();
    });

    it('lets a SuperAdmin through', async () => {
      mockRepository.listAccountsByTenantId.mockResolvedValueOnce([]);

      const response = await makeApp('SuperAdmin').request('/admin/linked-accounts');

      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /admin/linked-accounts/{accountId}', () => {
    it('releases the account', async () => {
      mockRepository.disconnectAccountById.mockResolvedValueOnce({
        ...ACCOUNT,
        syncStatus: 'disconnected',
      });

      const response = await makeApp('TenantAdmin').request(
        `/admin/linked-accounts/${ACCOUNT.id}`,
        { method: 'DELETE' },
      );
      const body = (await response.json()) as { syncStatus: string };

      expect(response.status).toBe(200);
      expect(mockRepository.disconnectAccountById).toHaveBeenCalledWith('tenant-1', ACCOUNT.id);
      expect(body.syncStatus).toBe('disconnected');
    });

    it('refuses a plain User', async () => {
      const response = await makeApp('User').request(`/admin/linked-accounts/${ACCOUNT.id}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(403);
      expect(mockRepository.disconnectAccountById).not.toHaveBeenCalled();
    });

    // The repository scopes the lookup by tenant, so an id from another
    // organisation is absent rather than forbidden.
    it("reads another tenant's account as missing", async () => {
      mockRepository.disconnectAccountById.mockRejectedValueOnce(
        new NotFoundError('InstagramAccount', ACCOUNT.id),
      );

      const response = await makeApp('TenantAdmin').request(
        `/admin/linked-accounts/${ACCOUNT.id}`,
        { method: 'DELETE' },
      );

      expect(response.status).toBe(404);
    });
  });
});
