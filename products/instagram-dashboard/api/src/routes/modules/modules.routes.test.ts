import { OpenAPIHono } from '@hono/zod-openapi';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { errorHandler } from '../../middleware/error-handler.js';
import type { ModulesService } from '../../services/modules.service.js';

import { createModulesRoutes } from './modules.routes.js';

const TENANT_ID = 'b3e4c5d6-e7f8-4a9b-a0c1-d2e3f4a5b6c7';
const USER_ID = 'user-1';

const mockGetAccessibleModuleIds = vi.fn();
const mockModulesService = {
  getAccessibleModuleIds: mockGetAccessibleModuleIds,
};

function makeApp() {
  const app = new OpenAPIHono();
  app.use('*', async (c, next) => {
    c.set('tenant', { tenantId: TENANT_ID, userId: USER_ID, tenantSlug: 'test', role: 'User' });
    await next();
  });
  app.route('/me', createModulesRoutes(mockModulesService as unknown as ModulesService));
  app.onError(errorHandler);
  return app;
}

describe('GET /me/modules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the entitled module ids for the current tenant/user', async () => {
    mockGetAccessibleModuleIds.mockResolvedValue(['ig-basic-metrics', 'ig-audience']);

    const app = makeApp();
    const res = await app.request('/me/modules');
    const body = (await res.json()) as { success: true; data: { moduleIds: string[] } };

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, data: { moduleIds: ['ig-basic-metrics', 'ig-audience'] } });
    expect(mockGetAccessibleModuleIds).toHaveBeenCalledWith(TENANT_ID, USER_ID);
  });

  it('propagates a 500 when the upstream lookup fails', async () => {
    mockGetAccessibleModuleIds.mockRejectedValue(new Error('iam entitlements lookup failed: 500'));

    const app = makeApp();
    const res = await app.request('/me/modules');

    expect(res.status).toBe(500);
  });
});
