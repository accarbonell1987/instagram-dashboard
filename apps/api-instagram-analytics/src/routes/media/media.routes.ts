import { createRoute } from '@hono/zod-openapi';
import type { OpenAPIHono } from '@hono/zod-openapi';

import { createApiRouter } from '../../lib/create-openapi-router.js';
import { ErrorResponseSchema, IdParamSchema } from '../../lib/shared-schemas.js';
import type { DashboardService } from '../../services/dashboard.service.js';
import {
  MediaDetailResponseSchema,
  MediaListResponseSchema,
  MediaQuerySchema,
  PlaybackResponseSchema,
} from './media.schemas.js';

const listMedia = createRoute({
  method: 'get',
  path: '/',
  tags: ['Media'],
  summary: 'List media with pagination and optional product type filter',
  request: { query: MediaQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: MediaListResponseSchema } },
      description: 'Paginated media list',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'No account connected',
    },
  },
});

const getMedia = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Media'],
  summary: 'Get media detail with metrics',
  request: { params: IdParamSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: MediaDetailResponseSchema } },
      description: 'Media detail',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Media not found',
    },
  },
});

const getPlaybackUrl = createRoute({
  method: 'get',
  path: '/{id}/playback',
  tags: ['Media'],
  summary: 'Get a fresh media_url from Instagram for in-app video playback',
  request: { params: IdParamSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: PlaybackResponseSchema } },
      description: 'Temporary video URL (expires in a few hours)',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Media not found',
    },
  },
});

export function createMediaRoutes(
  dashboardService: DashboardService,
): OpenAPIHono {
  const routes = createApiRouter();

  routes.openapi(listMedia, async (c) => {
    const tenant = c.get('tenant');
    const query = c.req.valid('query');
    const result = await dashboardService.listMedia(tenant.tenantId, tenant.userId, {
      ...(query.page !== undefined ? { page: query.page } : {}),
      ...(query.pageSize !== undefined ? { pageSize: query.pageSize } : {}),
      ...(query.productType !== undefined ? { mediaProductType: query.productType } : {}),
    });
    return c.json({ success: true, data: result }, 200);
  });

  routes.openapi(getMedia, async (c) => {
    const tenant = c.get('tenant');
    const { id } = c.req.valid('param');
    const media = await dashboardService.getMediaDetail(tenant.tenantId, tenant.userId, id);
    return c.json({ success: true, data: media }, 200);
  });

  routes.openapi(getPlaybackUrl, async (c) => {
    const tenant = c.get('tenant');
    const { id } = c.req.valid('param');
    const mediaUrl = await dashboardService.getMediaPlaybackUrl(tenant.tenantId, tenant.userId, id);
    return c.json({ success: true, data: { mediaUrl } }, 200);
  });

  return routes;
}
