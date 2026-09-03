import { z } from '@hono/zod-openapi';

export const ConnectionRequestBodySchema = z
  .object({
    username: z.string().min(1).max(40).openapi({ example: '@mi.cuenta' }),
  })
  .openapi('ConnectionRequestBody');

export const ConnectionRequestSchema = z
  .object({
    id: z.string().uuid(),
    username: z.string(),
    status: z.enum(['awaiting_invite', 'invite_sent', 'connected', 'failed']),
    lastError: z.string().nullable(),
    requestedAt: z.string(),
    inviteSentAt: z.string().nullable(),
    connectedAt: z.string().nullable(),
  })
  .openapi('ConnectionRequest');

/** La bandeja del operador agrega el tenant, que el cliente nunca necesita ver. */
export const PendingRequestSchema = ConnectionRequestSchema.extend({
  tenantId: z.string(),
  userId: z.string(),
}).openapi('PendingConnectionRequest');
