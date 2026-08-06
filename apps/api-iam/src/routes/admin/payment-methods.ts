import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import type { PrismaClient } from '../../generated/prisma/client.js'
import { ForbiddenError, ConflictError, NotFoundError, ValidationError } from '../../errors.js'
import type { BankAccount } from '../../adapters/payment/types.js'
import {
  BankAccountSchema,
  PaymentMethodConfigListResponseSchema,
  PaymentMethodConfigSchema,
  PaymentMethodParamsSchema,
  PaymentMethodUpdateRequestSchema,
  commonErrorResponses,
} from '../schemas/index.js'

function readAccounts(config: unknown): BankAccount[] {
  return (config as { accounts?: BankAccount[] } | null)?.accounts ?? []
}

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
      return c.json(
        {
          items: items.map((i) => ({
            method: i.method,
            enabled: i.enabled,
            displayName: i.displayName,
            accounts: readAccounts(i.config),
          })),
        },
        200,
      )
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
      const { enabled, displayName, accounts } = c.req.valid('json')

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

      // Structural validation lives here, not in the openapi request schema —
      // see the comment on PaymentMethodUpdateRequestSchema.accounts.
      let parsedAccounts: BankAccount[] | undefined
      if (accounts !== undefined) {
        const result = z.array(BankAccountSchema).safeParse(accounts)
        if (!result.success) {
          throw new ValidationError(
            'payment_method.invalid_accounts',
            'One or more bank accounts have an invalid shape',
            result.error.issues.map((issue) => ({
              field: issue.path.join('.'),
              code: issue.code,
              message: issue.message,
            })),
          )
        }
        parsedAccounts = result.data
      }

      // A customer who reaches the bank-transfer instructions with no accounts
      // configured gets a reference and nowhere to send money — refuse enabling
      // the method until at least one account exists.
      const nextAccounts = parsedAccounts ?? readAccounts(existing.config)
      if (method === 'bank_transfer' && enabled && nextAccounts.length === 0) {
        throw new ConflictError('payment_method.no_accounts_configured', 'Cannot enable bank transfer with no bank accounts configured')
      }

      const updated = await prisma.paymentMethodConfig.update({
        where: { method },
        data: {
          enabled,
          updatedBy: c.var.user.sub,
          ...(displayName !== undefined ? { displayName } : {}),
          ...(parsedAccounts !== undefined
            ? { config: { ...(existing.config as Record<string, unknown>), accounts: parsedAccounts } }
            : {}),
        },
      })
      return c.json(
        { method: updated.method, enabled: updated.enabled, displayName: updated.displayName, accounts: readAccounts(updated.config) },
        200,
      )
    },
  )

  return router
}
