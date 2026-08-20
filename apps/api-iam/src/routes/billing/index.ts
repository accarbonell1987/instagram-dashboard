import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import { ForbiddenError } from '../../errors.js'
import type { BillingService } from '../../services/index.js'
import {
  SignedUrlResponseSchema,
  PaymentMethodResponseSchema,
  PaymentMethodChangeResponseSchema,
  PaginationQuerySchema,
  PaymentListResponseSchema,
  commonErrorResponses,
} from '../schemas/index.js'


/**
 * Billing is the organisation's money: what it was charged, how it pays, and
 * the invoices and contract behind that.
 *
 * The hub hides /settings/billing behind TenantAdmin, and these handlers only
 * ever scoped by tenant — so any member of the organisation could list its
 * payments and download its invoices by asking the API directly. Hiding a
 * screen is not refusing the call it makes.
 */
function assertTenantAdmin(role: string): void {
  if (role !== 'TenantAdmin' && role !== 'SuperAdmin') {
    throw new ForbiddenError('billing.forbidden', 'TenantAdmin role required')
  }
}

export function createBillingRouter(
  billingService: BillingService,
  authGuard: MiddlewareHandler,
) {
  const router = new OpenAPIHono()

  router.use('/billing/*', authGuard)

  // ─── GET /billing/payment-method ─────────────────────────────────────────────

  const getPaymentMethodRoute = createRoute({
    method: 'get',
    path: '/billing/payment-method',
    operationId: 'getPaymentMethod',
    tags: ['billing'],
    responses: {
      200: {
        content: { 'application/json': { schema: PaymentMethodResponseSchema } },
        description: 'Current payment method',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
    },
  })

  router.openapi(getPaymentMethodRoute, async (c) => {
    assertTenantAdmin(c.var.user.role)
    const result = await billingService.getPaymentMethod()
    return c.json(result, 200)
  })

  // ─── POST /billing/payment-method ────────────────────────────────────────────

  const requestPaymentMethodChangeRoute = createRoute({
    method: 'post',
    path: '/billing/payment-method',
    operationId: 'requestPaymentMethodChange',
    tags: ['billing'],
    responses: {
      202: {
        content: { 'application/json': { schema: PaymentMethodChangeResponseSchema } },
        description: 'Payment method change request accepted',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      409: commonErrorResponses[409],
    },
  })

  router.openapi(requestPaymentMethodChangeRoute, async (c) => {
    assertTenantAdmin(c.var.user.role)
    const result = await billingService.requestPaymentMethodChange()
    return c.json(result, 202)
  })

  // ─── GET /billing/payments ────────────────────────────────────────────────────
  // The tenant's own ledger: every charge, with the invoice PDF attached to
  // the ones that settled. There used to be a second list at /billing/invoices
  // showing the same events with fewer columns — one table reads better than
  // two views of one truth.

  const listPaymentsRoute = createRoute({
    method: 'get',
    path: '/billing/payments',
    operationId: 'listPayments',
    tags: ['billing', 'payments'],
    request: { query: PaginationQuerySchema },
    responses: {
      200: { content: { 'application/json': { schema: PaymentListResponseSchema } }, description: 'Paginated payment history' },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
    },
  })

  router.openapi(listPaymentsRoute, async (c) => {
    assertTenantAdmin(c.var.user.role)
    const { page, pageSize } = c.req.valid('query')
    const result = await billingService.listPayments({ tenantUuid: c.var.user.tenantUuid, page, pageSize })
    return c.json(result, 200)
  })

  // ─── GET /billing/documents/{documentId}/signed-url ──────────────────────────

  const getSignedUrlRoute = createRoute({
    method: 'get',
    path: '/billing/documents/{documentId}/signed-url',
    operationId: 'getSignedDocumentUrl',
    tags: ['billing'],
    request: {
      params: z.object({ documentId: z.string() }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: SignedUrlResponseSchema } },
        description: 'Signed document URL',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
    },
  })

  router.openapi(getSignedUrlRoute, async (c) => {
    assertTenantAdmin(c.var.user.role)
    const { documentId } = c.req.valid('param')
    const result = await billingService.getSignedDocumentUrl({
      documentId,
      tenantUuid: c.var.user.tenantUuid,
    })
    return c.json(
      {
        url: result.url,
        expiresAt: result.expiresAt.toISOString(),
      },
      200,
    )
  })

  return router
}
