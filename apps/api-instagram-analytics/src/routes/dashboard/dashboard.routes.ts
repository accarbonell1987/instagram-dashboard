import { createRoute } from '@hono/zod-openapi';
import type { OpenAPIHono } from '@hono/zod-openapi';

import { createApiRouter } from '../../lib/create-openapi-router.js';
import { ErrorResponseSchema } from '../../lib/shared-schemas.js';
import type { DashboardService } from '../../services/dashboard.service.js';
import type { InsightService } from '../../services/insight.service.js';
import {
  DashboardResponseSchema,
  DashboardQuerySchema,
  InsightResponseSchema,
  GrowthQuerySchema,
  GrowthResponseSchema,
  DemographicsResponseSchema,
} from './dashboard.schemas.js';

const getDashboard = createRoute({
  method: 'get',
  path: '/',
  tags: ['Dashboard'],
  summary: 'Get full dashboard data with north-star metrics',
  request: { query: DashboardQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: DashboardResponseSchema } },
      description: 'Dashboard data',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'No account connected',
    },
  },
});

const getInsight = createRoute({
  method: 'get',
  path: '/insight',
  tags: ['Dashboard'],
  summary: 'Get actionable insight',
  responses: {
    200: {
      content: { 'application/json': { schema: InsightResponseSchema } },
      description: 'Insight result',
    },
  },
});

const getGrowth = createRoute({
  method: 'get',
  path: '/growth',
  tags: ['Dashboard'],
  summary: 'Get growth data for a metric over a period',
  request: { query: GrowthQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: GrowthResponseSchema } },
      description: 'Growth data points',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid query parameters',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'No account connected',
    },
  },
});

const getDemographics = createRoute({
  method: 'get',
  path: '/demographics',
  tags: ['Dashboard'],
  summary: 'Get follower demographics (age, gender, country, city)',
  responses: {
    200: {
      content: { 'application/json': { schema: DemographicsResponseSchema } },
      description: 'Demographics data',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'No account connected',
    },
  },
});

export function createDashboardRoutes(
  dashboardService: DashboardService,
  insightService: InsightService,
): OpenAPIHono {
  const routes = createApiRouter();

  routes.openapi(getDashboard, async (c) => {
    const tenant = c.get('tenant');
    const { period } = c.req.valid('query');
    const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : period === '1y' ? 365 : 90;

    const data = await dashboardService.getDashboardDataWithNorthStar(
      tenant.tenantId,
      tenant.userId,
      periodDays,
    );

    const insight = insightService.generateInsight(data);
    data.insight = insight;

    return c.json({ success: true, data }, 200);
  });

  routes.openapi(getInsight, async (c) => {
    const tenant = c.get('tenant');
    const data = await dashboardService.getDashboardData(tenant.tenantId, tenant.userId);
    const insight = insightService.generateInsight(data);
    return c.json({ success: true, data: insight }, 200);
  });

  routes.openapi(getGrowth, async (c) => {
    const { metric, period } = c.req.valid('query');
    const tenant = c.get('tenant');
    const result = await dashboardService.getGrowthData(
      tenant.tenantId,
      tenant.userId,
      metric,
      period,
    );
    return c.json({ success: true, data: result }, 200);
  });

  routes.openapi(getDemographics, async (c) => {
    const tenant = c.get('tenant');
    const result = await dashboardService.getDemographicsData(tenant.tenantId, tenant.userId);
    return c.json({ success: true, data: result }, 200);
  });

  return routes;
}
