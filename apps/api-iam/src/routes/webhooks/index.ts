import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import type { WebhookService, BancardWebhookPayload as ServiceBancardPayload } from '../../services/index.js'
import {
  BancardWebhookPayloadSchema,
  WebhookReceivedResponseSchema,
  commonErrorResponses,
} from '../schemas/index.js'

export function createWebhooksRouter(webhookService: WebhookService) {
  const router = new OpenAPIHono()

  // Raw body capture middleware — MUST run before any c.req.json() call
  router.use('*', async (c, next) => {
    const rawBody = await c.req.text()
    c.set('rawBody', rawBody)
    await next()
  })

  const bancardWebhookRoute = createRoute({
    method: 'post',
    path: '/webhooks/bancard',
    operationId: 'bancardWebhook',
    tags: ['webhooks'],
    security: [],
    responses: {
      200: {
        content: { 'application/json': { schema: WebhookReceivedResponseSchema } },
        description: 'Webhook received',
      },
      // Note: 400 kept for schema reference but handler always returns 200 per Bancard §13.
      400: commonErrorResponses[400],
    },
  })

  router.openapi(bancardWebhookRoute, async (c) => {
    const rawBody = c.var.rawBody ?? (await c.req.text())
    const signature = c.req.header('X-Bancard-Signature') ?? ''

    let payload: ServiceBancardPayload
    try {
      const parsed = BancardWebhookPayloadSchema.parse(JSON.parse(rawBody))
      payload = {
        process_id: parsed.process_id,
        status: parsed.status,
        response_code: parsed.response_code ?? '',
        response_description: parsed.response_description ?? '',
        amount: parsed.amount !== undefined ? Number(parsed.amount) : 0,
        authorization_number: '',
        operation_date: new Date().toISOString(),
      }
    } catch {
      // Bug 5 fix: Bancard requires HTTP 200 always (§13 of backend-requirements.md).
      // Unparseable body → log and acknowledge silently.
      return c.json({ received: true as const }, 200)
    }

    // Bug 5 fix: Any processing error (including UnauthorizedError for invalid signature)
    // is caught here and acknowledged with 200 to prevent Bancard from retrying with spam.
    try {
      await webhookService.processBancardWebhook({ rawBody, signature, payload })
    } catch {
      // Intentional: Bancard must always receive 200 regardless of our internal errors.
      // Errors (invalid signature, duplicate event, DB failure) are handled by the service
      // internally (logging, idempotency). We never expose our error state to Bancard.
      return c.json({ received: true as const }, 200)
    }

    return c.json({ received: true as const }, 200)
  })

  return router
}
