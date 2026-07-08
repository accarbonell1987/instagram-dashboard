import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import type { BillingService } from '../../services/index.js'
import {
  SignedUrlResponseSchema,
  PaymentMethodResponseSchema,
  PaymentMethodChangeResponseSchema,
  InvoiceListResponseSchema,
  InvoiceListQuerySchema,
  commonErrorResponses,
} from '../schemas/index.js'
import { NotFoundError } from '../../errors.js'

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
    const result = await billingService.requestPaymentMethodChange()
    return c.json(result, 202)
  })

  // ─── GET /billing/invoices ────────────────────────────────────────────────────

  const listInvoicesRoute = createRoute({
    method: 'get',
    path: '/billing/invoices',
    operationId: 'listInvoices',
    tags: ['billing'],
    request: {
      query: InvoiceListQuerySchema,
    },
    responses: {
      200: {
        content: { 'application/json': { schema: InvoiceListResponseSchema } },
        description: 'Invoice list',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
    },
  })

  router.openapi(listInvoicesRoute, async (c) => {
    const { page, pageSize } = c.req.valid('query')
    const result = await billingService.listInvoices({ page, pageSize })
    return c.json(result, 200)
  })

  // ─── GET /billing/invoices/{invoiceId}/signed-url ─────────────────────────────

  const getInvoiceSignedUrlRoute = createRoute({
    method: 'get',
    path: '/billing/invoices/{invoiceId}/signed-url',
    operationId: 'getInvoiceSignedUrl',
    tags: ['billing'],
    request: {
      params: z.object({ invoiceId: z.string() }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: SignedUrlResponseSchema } },
        description: 'Signed invoice document URL',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
    },
  })

  router.openapi(getInvoiceSignedUrlRoute, async (_c) => {
    throw new NotFoundError('billing.invoice_document_not_found')
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
