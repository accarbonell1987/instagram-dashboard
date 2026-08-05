import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import type { PrismaClient } from '../../generated/prisma/client.js'
import type { SettlementService } from '../../services/index.js'
import type { PaymentStatus } from '../../domain/index.js'
import { mapPayment } from '../../repositories/payment/payment.repository.js'
import { toContractPayment } from '../../lib/payment-mapper.js'
import { ForbiddenError, NotFoundError } from '../../errors.js'
import {
  AdminPaymentListQuerySchema,
  TenantPaymentListQuerySchema,
  PaymentListResponseSchema,
  PaymentParamsSchema,
  PaymentNoteRequestSchema,
  PaymentSchema,
  commonErrorResponses,
} from '../schemas/index.js'
import { AdminTenantParamsSchema } from '../schemas/admin.schemas.js'

function assertSuperAdmin(role: string): void {
  if (role !== 'SuperAdmin') {
    throw new ForbiddenError('payments.forbidden', 'SuperAdmin role required')
  }
}

// Contract's Payment.status has 'timeout' where the domain has 'reversed'
// (see lib/payment-mapper.ts:mapPaymentStatus for the inverse direction).
function toDomainStatus(status: string): PaymentStatus {
  return status === 'timeout' ? 'reversed' : (status as PaymentStatus)
}

export function createAdminPaymentsRouter(
  settlementService: SettlementService,
  prisma: PrismaClient,
  authGuard: MiddlewareHandler,
  idempotency: MiddlewareHandler,
) {
  const router = new OpenAPIHono()

  router.use('/admin/payments', authGuard)
  router.use('/admin/payments/:id/confirm', authGuard)
  router.use('/admin/payments/:id/reject', authGuard)
  router.use('/admin/tenants/:tenantId/payments', authGuard)
  router.on('POST', '/admin/payments/:id/confirm', idempotency)
  router.on('POST', '/admin/payments/:id/reject', idempotency)

  // ── GET /admin/payments — reconciliation queue across tenants ────────────

  router.openapi(
    createRoute({
      method: 'get',
      path: '/admin/payments',
      operationId: 'adminListPayments',
      tags: ['admin', 'payments'],
      request: { query: AdminPaymentListQuerySchema },
      responses: {
        200: { content: { 'application/json': { schema: PaymentListResponseSchema } }, description: 'Paginated payments queue' },
        401: commonErrorResponses[401],
        403: commonErrorResponses[403],
      },
    }),
    async (c) => {
      assertSuperAdmin(c.var.user.role)
      const { status, tenantId, reference, dateFrom, dateTo, page, pageSize } = c.req.valid('query')

      // ponytail: Payment.tenantId backfill is slice-4 scope (design "File
      // Changes / Slice 4") — until it lands, orphan payments are excluded
      // rather than violating the contract's required, non-null tenantId.
      const where: Record<string, unknown> = { tenantId: { not: null } }
      if (status) where['status'] = toDomainStatus(status)
      if (tenantId) where['tenantId'] = tenantId
      if (reference) where['externalRef'] = reference
      if (dateFrom || dateTo) {
        where['initiatedAt'] = {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        }
      }

      const [rows, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          include: { tenant: { select: { name: true } } },
          orderBy: { initiatedAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.payment.count({ where }),
      ])

      const items = rows.map(({ tenant, ...raw }) => toContractPayment(mapPayment(raw), tenant?.name))
      return c.json({ items, total, page, pageSize }, 200)
    },
  )

  // ── POST /admin/payments/{id}/confirm ─────────────────────────────────────

  router.openapi(
    createRoute({
      method: 'post',
      path: '/admin/payments/{id}/confirm',
      operationId: 'adminConfirmPayment',
      tags: ['admin', 'payments'],
      request: { params: PaymentParamsSchema, body: { content: { 'application/json': { schema: PaymentNoteRequestSchema } } } },
      responses: {
        200: { content: { 'application/json': { schema: PaymentSchema } }, description: 'Payment settled (or already-settled, returned as-is)' },
        401: commonErrorResponses[401],
        403: commonErrorResponses[403],
        404: commonErrorResponses[404],
        422: commonErrorResponses[422],
      },
    }),
    async (c) => {
      assertSuperAdmin(c.var.user.role)
      const { id } = c.req.valid('param')
      const { note } = c.req.valid('json')
      // settlePayment throws NotFoundError/ValidationError for an unmatched
      // id / empty note — no duplicate lookup needed here.
      const result = await settlementService.settlePayment({
        paymentId: id,
        decision: 'approved',
        settlementKind: 'agent_review',
        settledBy: c.var.user.sub,
        note,
      })
      return c.json(toContractPayment(result.payment), 200)
    },
  )

  // ── POST /admin/payments/{id}/reject ──────────────────────────────────────

  router.openapi(
    createRoute({
      method: 'post',
      path: '/admin/payments/{id}/reject',
      operationId: 'adminRejectPayment',
      tags: ['admin', 'payments'],
      request: { params: PaymentParamsSchema, body: { content: { 'application/json': { schema: PaymentNoteRequestSchema } } } },
      responses: {
        200: { content: { 'application/json': { schema: PaymentSchema } }, description: 'Payment rejected' },
        401: commonErrorResponses[401],
        403: commonErrorResponses[403],
        404: commonErrorResponses[404],
        422: commonErrorResponses[422],
      },
    }),
    async (c) => {
      assertSuperAdmin(c.var.user.role)
      const { id } = c.req.valid('param')
      const { note } = c.req.valid('json')
      const result = await settlementService.settlePayment({
        paymentId: id,
        decision: 'declined',
        settlementKind: 'agent_review',
        settledBy: c.var.user.sub,
        note,
      })
      return c.json(toContractPayment(result.payment), 200)
    },
  )

  // ── GET /admin/tenants/{tenantId}/payments ────────────────────────────────

  router.openapi(
    createRoute({
      method: 'get',
      path: '/admin/tenants/{tenantId}/payments',
      operationId: 'adminListTenantPayments',
      tags: ['admin', 'payments', 'tenants'],
      request: { params: AdminTenantParamsSchema, query: TenantPaymentListQuerySchema },
      responses: {
        200: { content: { 'application/json': { schema: PaymentListResponseSchema } }, description: 'Paginated tenant payment history' },
        401: commonErrorResponses[401],
        403: commonErrorResponses[403],
        404: commonErrorResponses[404],
      },
    }),
    async (c) => {
      assertSuperAdmin(c.var.user.role)
      const { tenantId } = c.req.valid('param')
      const { page, pageSize } = c.req.valid('query')

      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
      if (!tenant) throw new NotFoundError('tenant.not_found')

      const where = { tenantId }
      const [rows, total] = await Promise.all([
        prisma.payment.findMany({ where, orderBy: { initiatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
        prisma.payment.count({ where }),
      ])

      const items = rows.map((raw) => toContractPayment(mapPayment(raw), tenant.name))
      return c.json({ items, total, page, pageSize }, 200)
    },
  )

  return router
}
