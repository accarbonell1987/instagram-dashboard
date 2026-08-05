import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import type { PrismaClient } from '../../generated/prisma/client.js'
import { PaymentMethodOptionListResponseSchema } from '../schemas/index.js'

// Public counterpart of GET /admin/payment-methods — the signup wizard is
// unauthenticated, so it cannot call the SuperAdmin-gated endpoint. Returns
// only enabled methods, no bank-account details (those belong to the
// initiate instruction, not to an anonymous list).
export function createPaymentMethodsRouter(prisma: PrismaClient) {
  const router = new OpenAPIHono()

  router.openapi(
    createRoute({
      method: 'get',
      path: '/payment-methods',
      operationId: 'listPaymentMethods',
      tags: ['onboarding', 'payments'],
      security: [],
      responses: {
        200: { content: { 'application/json': { schema: PaymentMethodOptionListResponseSchema } }, description: 'Enabled payment methods' },
      },
    }),
    async (c) => {
      const items = await prisma.paymentMethodConfig.findMany({
        where: { enabled: true },
        orderBy: { method: 'asc' },
        select: { method: true, displayName: true },
      })
      return c.json({ items }, 200)
    },
  )

  return router
}
