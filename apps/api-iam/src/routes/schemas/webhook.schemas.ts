import { z } from '@hono/zod-openapi'

export const BancardWebhookPayloadSchema = z.object({
  process_id: z.string(),
  status: z.string(),
  currency: z.string().optional(),
  amount: z.string().optional(),
  response_code: z.string().optional(),
  response_description: z.string().optional(),
})

export type BancardWebhookPayload = z.infer<typeof BancardWebhookPayloadSchema>

export const WebhookReceivedResponseSchema = z.object({
  received: z.literal(true),
})
