import { z } from '@hono/zod-openapi';
import { DataResponseSchema } from '../../lib/shared-schemas.js';

// ─── Request schemas ──────────────────────────────────────────────────────────

export const SuggestionsQuerySchema = z.object({
  status: z.enum(['pending', 'used', 'dismissed']).optional(),
});

export const MarkUsedRequestSchema = z.object({
  linkedMediaId: z.string().uuid().optional(),
});

export const GenerateIdeaBodySchema = z.object({
  prompt: z.string().min(3).max(500),
});

// ─── Response schemas ─────────────────────────────────────────────────────────

export const SuggestionItemSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  category: z.string(),
  content: z.string(),
  status: z.string(),
  linkedMediaId: z.string().nullable(),
  outcome: z.string().nullable(),
  createdAt: z.union([z.string(), z.date()]).transform((v) =>
    v instanceof Date ? v.toISOString() : v,
  ),
});

export const SuggestionsResponseSchema = DataResponseSchema(z.array(SuggestionItemSchema));

export const DismissResponseSchema = DataResponseSchema(
  z.object({ id: z.string() }),
);
