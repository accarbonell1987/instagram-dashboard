import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import type { PrismaClient } from '../../generated/prisma/client.js'
import { ForbiddenError, ConflictError, NotFoundError } from '../../errors.js'
import {
  PaymentMethodConfigListResponseSchema,
  PaymentMethodConfigSchema,
  PaymentMethodParamsSchema,
  PaymentMethodUpdateRequestSchema,
  commonErrorResponses,
} from '../schemas/index.js'

function assertSuperAdmin(role: string): void {
  if (role !== 'SuperAdmin') {
    throw new ForbiddenError('payments.forbidden', 'SuperAdmin role required')
  }
}

export function createAdminPaymentMethodsRouter(
  prisma: PrismaClient,
  authGuard: MiddlewareHandler,
  idempotency: MiddlewareHandler,
) {
  const router = new OpenAPIHono()

  router.use('/admin/payment-methods', authGuard)
  router.use('/admin/payment-methods/:method', authGuard)
  router.on('PATCH', '/admin/payment-methods/:method', idempotency)

  // ── GET /admin/payment-methods ─────────────────────────────────────────────

  router.openapi(
    createRoute({
      method: 'get',
      path: '/admin/payment-methods',
      operationId: 'adminListPaymentMethods',
      tags: ['admin', 'payments'],
      responses: {
        200: { content: { 'application/json': { schema: PaymentMethodConfigListResponseSchema } }, description: 'Payment method config list' },
        401: commonErrorResponses[401],
        403: commonErrorResponses[403],
      },
    }),
    async (c) => {
      assertSuperAdmin(c.var.user.role)
      const items = await prisma.paymentMethodConfig.findMany({ orderBy: { method: 'asc' } })
      return c.json({ items: items.map((i) => ({ method: i.method, enabled: i.enabled })) }, 200)
    },
  )

  // ── PATCH /admin/payment-methods/{method} ──────────────────────────────────

  router.openapi(
    createRoute({
      method: 'patch',
      path: '/admin/payment-methods/{method}',
      operationId: 'adminUpdatePaymentMethod',
      tags: ['admin', 'payments'],
      request: { params: PaymentMethodParamsSchema, body: { content: { 'application/json': { schema: PaymentMethodUpdateRequestSchema } } } },
      responses: {
        200: { content: { 'application/json': { schema: PaymentMethodConfigSchema } }, description: 'Payment method updated' },
        401: commonErrorResponses[401],
        403: commonErrorResponses[403],
        404: commonErrorResponses[404],
        409: commonErrorResponses[409],
      },
    }),
    async (c) => {
      assertSuperAdmin(c.var.user.role)
      const { method } = c.req.valid('param')
      const { enabled } = c.req.valid('json')

      const existing = await prisma.paymentMethodConfig.findUnique({ where: { method } })
      if (!existing) throw new NotFoundError('payment_method.not_found')

      // enabled=false gates new initiation only, never settlement of existing
      // payments (spec "payment-method-config") — and the last enabled method
      // can never be disabled (mirrors the identity.last_admin guard).
      if (enabled === false && existing.enabled) {
        const enabledCount = await prisma.paymentMethodConfig.count({ where: { enabled: true } })
        if (enabledCount <= 1) {
          throw new ConflictError('payment_method.last_enabled', 'Cannot disable the last enabled payment method')
        }
      }

      const updated = await prisma.paymentMethodConfig.update({
        where: { method },
        data: { enabled, updatedBy: c.var.user.sub },
      })
      return c.json({ method: updated.method, enabled: updated.enabled }, 200)
    },
  )

  return router
}
