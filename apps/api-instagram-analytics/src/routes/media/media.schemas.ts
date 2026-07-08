import { z } from '@hono/zod-openapi';

import {
  DataResponseSchema,
  PaginationParamsSchema,
} from '../../lib/shared-schemas.js';

export const MediaQuerySchema = PaginationParamsSchema.extend({
  type: z.enum(['IMAGE', 'VIDEO', 'CAROUSEL_ALBUM']).optional(),
  productType: z.enum(['FEED', 'REELS', 'STORY']).optional(),
});

export const MediaWithMetricsSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  igMediaId: z.string(),
  mediaType: z.string(),
  mediaProductType: z.string().nullable(),
  permalink: z.string().nullable(),
  caption: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  postedAt: z.string(),
  metrics: z
    .object({
      likes: z.number(),
      comments: z.number(),
      saves: z.number(),
      shares: z.number(),
      reach: z.number(),
      impressions: z.number(),
      totalInteractions: z.number(),
      videoViews: z.number().nullable(),
      avgWatchTime: z.number().nullable(),
      videoViewTotalTime: z.number().nullable(),
      syncedAt: z.string(),
    })
    .nullable(),
});

export const MediaDetailResponseSchema =
  DataResponseSchema(MediaWithMetricsSchema);

export const MediaListResponseSchema = DataResponseSchema(
  z.object({
    data: z.array(MediaWithMetricsSchema),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
  }),
);

export const PlaybackResponseSchema = DataResponseSchema(
  z.object({ mediaUrl: z.string().nullable() }),
);
