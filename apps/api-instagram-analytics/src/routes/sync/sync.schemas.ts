import { z } from '@hono/zod-openapi';

import { DataResponseSchema } from '../../lib/shared-schemas.js';

export const SyncTriggerResponseSchema = DataResponseSchema(
  z.object({
    syncId: z.string(),
    status: z.enum(['started', 'already_running', 'rate_limited']),
  }),
);

export const SyncStatusSchema = z.object({
  status: z.enum(['idle', 'syncing', 'paused', 'error']),
  lastSyncAt: z.string().nullable(),
  mediaCount: z.number(),
  nextSyncAvailableAt: z.string().nullable(),
});

export const SyncStatusResponseSchema = DataResponseSchema(SyncStatusSchema);

export const BackfillResponseSchema = DataResponseSchema(
  z.object({ inserted: z.number() }),
);
