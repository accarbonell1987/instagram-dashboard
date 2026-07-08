import { z } from '@hono/zod-openapi';

export const OAuthCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export const ConnectionStatusSchema = z.object({
  connected: z.boolean(),
  username: z.string().optional(),
  accountType: z.string().optional(),
  tokenExpiresAt: z.string().optional(),
});

export const ConnectionStatusResponseSchema = z.object({
  success: z.literal(true),
  data: ConnectionStatusSchema,
});
