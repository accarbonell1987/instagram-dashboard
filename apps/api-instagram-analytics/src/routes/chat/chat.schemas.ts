import { z } from '@hono/zod-openapi';
import { DataResponseSchema } from '../../lib/shared-schemas.js';

// ─── Request schemas ──────────────────────────────────────────────────────────

export const ChatRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      }),
    )
    .max(20)
    .optional()
    .default([]),
});

export const ChatHistoryQuerySchema = z.object({
  sessionId: z.string().uuid(),
});

export const DeleteMessageParamsSchema = z.object({
  id: z.string().uuid(),
});

export const DeleteHistoryQuerySchema = z.object({
  sessionId: z.string().uuid(),
});

// ─── Response schemas ─────────────────────────────────────────────────────────

export const SuggestionSchema = z.object({
  id: z.string().uuid(),
  category: z.enum(['caption', 'format', 'posting_time', 'hook', 'hashtags', 'content_idea']),
  content: z.string(),
  status: z.enum(['pending', 'used', 'dismissed']),
  linkedMediaId: z.string().uuid().nullable(),
  outcome: z.enum(['exceeded', 'met', 'below']).nullable(),
  createdAt: z.string().datetime().or(z.date()).transform((v) => (v instanceof Date ? v.toISOString() : v)),
});

export const ToolCallSchema = z.object({
  name: z.string(),
  arguments: z.record(z.unknown()),
  result: z.unknown().optional(),
});

export const ChatResponseSchema = DataResponseSchema(
  z.object({
    reply: z.string(),
    sessionId: z.string().uuid(),
    suggestions: z.array(SuggestionSchema),
    toolCallsTrace: z.array(ToolCallSchema),
  }),
);

export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  sessionId: z.string().uuid(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  createdAt: z.string().datetime().or(z.date()).transform((v) => (v instanceof Date ? v.toISOString() : v)),
});

export const ChatHistoryResponseSchema = DataResponseSchema(z.array(ChatMessageSchema));
