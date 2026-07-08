/**
 * Integration tests for growth route.
 *
 * GET /api/dashboard/growth?metric=X&period=Y
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../../lib/jwt-verifier.js', () => ({
  verifyAccessToken: vi.fn(),
}));

import { verifyAccessToken } from '../../lib/jwt-verifier.js';
import { authGuard } from '../../middleware/auth-guard.js';
import { errorHandler } from '../../middleware/error-handler.js';
import type { DashboardService } from '../../services/dashboard.service.js';
import type { InsightService } from '../../services/insight.service.js';
import { createDashboardRoutes } from './dashboard.routes.js';

const MOCK_TENANT = {
  userId: 'user-uuid-123',
  tenantId: 'tenant-uuid-456',
  tenantSlug: 'test-tenant',
  role: 'User',
} as const;

interface GrowthDataPoint {
  date: string;
  value: number;
}

function createTestApp(
  dashboardService: Pick<DashboardService, 'getGrowthData' | 'getDashboardData'>,
  insightService: Pick<InsightService, 'generateInsight'>,
) {
  const app = new Hono();
  const api = new Hono();

  api.use('*', authGuard);

  const routes = createDashboardRoutes(
    dashboardService as DashboardService,
    insightService as InsightService,
  );
  api.route('/dashboard', routes);

  app.route('/api', api);
  app.onError(errorHandler);

  return app;
}

describe('GET /api/dashboard/growth', () => {
  let mockDashboardService: {
    getGrowthData: ReturnType<typeof vi.fn>;
    getDashboardData: ReturnType<typeof vi.fn>;
  };
  let mockInsightService: { generateInsight: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDashboardService = {
      getGrowthData: vi.fn(),
      getDashboardData: vi.fn(),
    };
    mockInsightService = { generateInsight: vi.fn().mockReturnValue({ insight: '', generatedAt: '' }) };
  });

  it('returns 200 with growth data for valid parameters', async () => {
    vi.mocked(verifyAccessToken).mockResolvedValue(MOCK_TENANT);
    const growthPoints: GrowthDataPoint[] = [
      { date: '2026-06-15T10:00:00.000Z', value: 1000 },
      { date: '2026-06-16T10:00:00.000Z', value: 1050 },
    ];
    mockDashboardService.getGrowthData.mockResolvedValue(growthPoints);

    const app = createTestApp(mockDashboardService as unknown as DashboardService, mockInsightService as unknown as InsightService);
    const req = new Request(
      'http://localhost/api/dashboard/growth?metric=followers&period=7d',
      { headers: { Authorization: 'Bearer valid-token' } },
    );

    const res = await app.fetch(req);
    const body = (await res.json()) as { success: boolean; data: GrowthDataPoint[] };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0]!.value).toBe(1000);

    expect(mockDashboardService.getGrowthData).toHaveBeenCalledWith(
      MOCK_TENANT.tenantId,
      MOCK_TENANT.userId,
      'followers',
      '7d',
    );
  });

  it('returns 400 for invalid metric', async () => {
    vi.mocked(verifyAccessToken).mockResolvedValue(MOCK_TENANT);

    const app = createTestApp(mockDashboardService as unknown as DashboardService, mockInsightService as unknown as InsightService);
    const req = new Request(
      'http://localhost/api/dashboard/growth?metric=invalid&period=7d',
      { headers: { Authorization: 'Bearer valid-token' } },
    );

    const res = await app.fetch(req);
    expect(res.status).toBe(400);

    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for missing query params', async () => {
    vi.mocked(verifyAccessToken).mockResolvedValue(MOCK_TENANT);

    const app = createTestApp(mockDashboardService as unknown as DashboardService, mockInsightService as unknown as InsightService);
    const req = new Request(
      'http://localhost/api/dashboard/growth',
      { headers: { Authorization: 'Bearer valid-token' } },
    );

    const res = await app.fetch(req);
    expect(res.status).toBe(400);
  });

  it('passes tenant context from auth guard', async () => {
    const customTenant = {
      userId: 'user-b',
      tenantId: 'tenant-b',
      tenantSlug: 'slug-b',
      role: 'User',
    };
    vi.mocked(verifyAccessToken).mockResolvedValue(customTenant);
    mockDashboardService.getGrowthData.mockResolvedValue([]);

    const app = createTestApp(mockDashboardService as unknown as DashboardService, mockInsightService as unknown as InsightService);
    const req = new Request(
      'http://localhost/api/dashboard/growth?metric=reach&period=90d',
      { headers: { Authorization: 'Bearer valid-token' } },
    );

    await app.fetch(req);

    expect(mockDashboardService.getGrowthData).toHaveBeenCalledWith(
      'tenant-b',
      'user-b',
      'reach',
      '90d',
    );
  });
});
