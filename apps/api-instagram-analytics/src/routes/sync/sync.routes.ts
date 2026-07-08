import { createRoute } from '@hono/zod-openapi';
import type { OpenAPIHono } from '@hono/zod-openapi';

import { createApiRouter } from '../../lib/create-openapi-router.js';
import { ErrorResponseSchema } from '../../lib/shared-schemas.js';
import { rateLimitMiddleware } from '../../middleware/rate-limiter.js';
import type { SyncService } from '../../services/sync.service.js';
import {
  BackfillResponseSchema,
  SyncStatusResponseSchema,
  SyncTriggerResponseSchema,
} from './sync.schemas.js';

const triggerSync = createRoute({
  method: 'post',
  path: '/trigger',
  tags: ['Sync'],
  summary: 'Trigger a manual synchronization',
  middleware: [rateLimitMiddleware] as const,
  responses: {
    200: {
      content: { 'application/json': { schema: SyncTriggerResponseSchema } },
      description: 'Sync triggered',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'No account connected',
    },
    429: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Rate limited',
    },
  },
});

const getSyncStatus = createRoute({
  method: 'get',
  path: '/status',
  tags: ['Sync'],
  summary: 'Get current sync status',
  responses: {
    200: {
      content: { 'application/json': { schema: SyncStatusResponseSchema } },
      description: 'Sync status',
    },
  },
});

const backfillHistory = createRoute({
  method: 'post',
  path: '/backfill',
  tags: ['Sync'],
  summary: 'Backfill up to 365 days of historical follower data from Instagram',
  responses: {
    200: {
      content: { 'application/json': { schema: BackfillResponseSchema } },
      description: 'Number of new records inserted',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'No account connected',
    },
  },
});

export function createSyncRoutes(syncService: SyncService): OpenAPIHono {
  const routes = createApiRouter();

  routes.openapi(backfillHistory, async (c) => {
    const tenant = c.get('tenant');
    const result = await syncService.backfillFollowerHistory(tenant.tenantId, tenant.userId);
    return c.json({ success: true, data: result }, 200);
  });

  routes.openapi(triggerSync, async (c) => {
    const tenant = c.get('tenant');
    const result = await syncService.triggerSync(tenant.tenantId, tenant.userId);
    const data = {
      syncId: result.syncId,
      status: result.status as 'started' | 'already_running' | 'rate_limited',
    };
    return c.json({ success: true, data }, 200);
  });

  routes.openapi(getSyncStatus, async (c) => {
    const tenant = c.get('tenant');
    const status = await syncService.getSyncStatus(tenant.tenantId, tenant.userId);
    const data = {
      status: status.status as 'idle' | 'syncing' | 'paused' | 'error',
      lastSyncAt: status.lastSyncAt,
      mediaCount: status.mediaCount,
      nextSyncAvailableAt: status.nextSyncAvailableAt,
    };
    return c.json({ success: true, data }, 200);
  });

  return routes;
}
