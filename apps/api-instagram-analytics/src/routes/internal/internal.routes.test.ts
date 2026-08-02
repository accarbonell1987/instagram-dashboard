/**
 * Unit tests for internal routes
 *
 * T-10: POST /internal/quotas/purge — cache-bust endpoint called by api-iam
 * when admin updates plan quotas.
 *
 * Strict TDD: RED phase — test written before implementation.
 */
import { OpenAPIHono } from '@hono/zod-openapi';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { errorHandler } from '../../middleware/error-handler.js';

import { createInternalRoutes } from './internal.routes.js';


// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPurgeCache = vi.fn();

const mockUsageTracker = {
  purgeCache: mockPurgeCache,
};

function makeApp() {
  const app = new OpenAPIHono();

  const routes = createInternalRoutes(
    mockUsageTracker as unknown as Parameters<typeof createInternalRoutes>[0],
  );
  app.route('/internal', routes);
  app.onError(errorHandler);
  return app;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Internal routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /internal/quotas/purge', () => {
    it('returns 200 with purged:true and calls purgeCache', async () => {
      mockPurgeCache.mockResolvedValueOnce(undefined);

      const app = makeApp();
      const res = await app.request('/internal/quotas/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: 'plan-pro' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; data: { purged: boolean } };
      expect(body.success).toBe(true);
      expect(body.data).toEqual({ purged: true });
      expect(mockPurgeCache).toHaveBeenCalledWith('plan-pro');
    });

    it('calls purgeCache without planId when body does not include planId', async () => {
      mockPurgeCache.mockResolvedValueOnce(undefined);

      const app = makeApp();
      const res = await app.request('/internal/quotas/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; data: { purged: boolean } };
      expect(body.success).toBe(true);
      expect(body.data).toEqual({ purged: true });
      expect(mockPurgeCache).toHaveBeenCalledWith(undefined);
    });

    it('handles body parsing errors gracefully (no body sent)', async () => {
      mockPurgeCache.mockResolvedValueOnce(undefined);

      const app = makeApp();
      const res = await app.request('/internal/quotas/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; data: { purged: boolean } };
      expect(body.success).toBe(true);
      expect(body.data).toEqual({ purged: true });
      expect(mockPurgeCache).toHaveBeenCalled();
    });
  });
});
