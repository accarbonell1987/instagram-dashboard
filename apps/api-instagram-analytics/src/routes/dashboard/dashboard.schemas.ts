import { z } from '@hono/zod-openapi';

import { DataResponseSchema } from '../../lib/shared-schemas.js';

const ContentFindingSchema = z.object({
  type: z.enum(['format', 'posting_time', 'top_commonality', 'caption_length']),
  pattern: z.string(),
  keyNumber: z.string(),
  action: z.string(),
  confidence: z.enum(['tentative', 'consistent']),
  postCount: z.number(),
});

const NorthStarMetricSchema = z.object({
  value: z.number(),
  previousValue: z.number(),
  delta: z.number(),
  deltaPercent: z.number().nullable(),
});

const NorthStarSchema = z.object({
  reachTotal: NorthStarMetricSchema,
  shareRate: NorthStarMetricSchema,
  saveRate: NorthStarMetricSchema,
  followerGrowth: NorthStarMetricSchema,
});

export const DashboardDataSchema = z.object({
  period: z.string(),
  account: z.object({
    username: z.string(),
    accountType: z.string(),
    followerCount: z.number().nullable(),
    displayName: z.string().nullable().optional(),
    profilePictureUrl: z.string().nullable().optional(),
    mediaCount: z.number().nullable().optional(),
  }),
  overview: z.object({
    totalPosts: z.number(),
    totalSaves: z.number(),
    totalShares: z.number(),
    totalImpressions: z.number(),
    totalReach: z.number(),
  }),
  northStar: NorthStarSchema.optional(),
  ranking: z.array(
    z.object({
      id: z.string(),
      igMediaId: z.string(),
      mediaType: z.string(),
      permalink: z.string().nullable(),
      caption: z.string().nullable(),
      thumbnailUrl: z.string().nullable(),
      postedAt: z.string(),
      saves: z.number(),
      shares: z.number(),
      likes: z.number(),
      comments: z.number(),
      reach: z.number(),
      totalEngagement: z.number(),
    }),
  ),
  formatBreakdown: z.array(
    z.object({
      format: z.string(),
      postCount: z.number(),
      avgSaves: z.number(),
      avgShares: z.number(),
      avgLikes: z.number(),
      avgComments: z.number(),
      avgReach: z.number(),
    }),
  ),
  heatmap: z.array(
    z.object({
      day: z.string(),
      dayIndex: z.number(),
      slot: z.string(),
      slotIndex: z.number(),
      totalSavesShares: z.number(),
      postCount: z.number(),
    }),
  ),
  insight: z.object({
    insight: z.string(),
    generatedAt: z.string(),
  }),
  findings: z.array(ContentFindingSchema).optional(),
  lastUpdated: z.string().optional(),
});

export const DashboardResponseSchema = DataResponseSchema(DashboardDataSchema);

export const InsightResultSchema = z.object({
  insight: z.string(),
  generatedAt: z.string(),
});

export const InsightResponseSchema = DataResponseSchema(InsightResultSchema);

// ── Growth endpoint schemas ──

export const GrowthMetricEnum = z.enum([
  'followers',
  'engagement',
  'reach',
  'impressions',
  'profileViews',
]);

export const GrowthPeriodEnum = z.enum(['all', '1y', '90d', '30d', '7d']);

export const GrowthQuerySchema = z.object({
  metric: GrowthMetricEnum,
  period: GrowthPeriodEnum.optional().default('1y'),
});

export const GrowthDataPointSchema = z.object({
  date: z.string(),
  value: z.number(),
});

export const GrowthResponseSchema = DataResponseSchema(
  z.array(GrowthDataPointSchema),
);

// ── Dashboard period query ──

export const DashboardQuerySchema = z.object({
  period: GrowthPeriodEnum.optional().default('30d'),
});

// ── Demographics schemas ──

const DemographicItemSchema = z.object({
  label: z.string(),
  value: z.number(),
  percentage: z.number(),
});

export const DemographicsDataSchema = z.object({
  age: z.array(DemographicItemSchema),
  gender: z.array(DemographicItemSchema),
  countries: z.array(DemographicItemSchema),
  cities: z.array(DemographicItemSchema),
  totalFollowersWithData: z.number(),
  coveragePercent: z.number(),
  followersTotal: z.number(),
});

export const DemographicsResponseSchema = DataResponseSchema(DemographicsDataSchema);
