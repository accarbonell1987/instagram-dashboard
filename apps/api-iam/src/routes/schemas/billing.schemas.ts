import { z } from '@hono/zod-openapi'

export const SignedUrlResponseSchema = z.object({
  url: z.string(),
  expiresAt: z.string(),
})

const PaymentMethodBrandSchema = z.enum(['visa', 'mastercard', 'amex', 'other'])

const PaymentMethodSchema = z
  .object({
    brand: PaymentMethodBrandSchema,
    lastFour: z.string().length(4),
    expiryMonth: z.number().int().min(1).max(12),
    expiryYear: z.number().int(),
  })
  .nullable()

export const PaymentMethodResponseSchema = z.object({
  paymentMethod: PaymentMethodSchema,
})

export const PaymentMethodChangeResponseSchema = z.object({
  id: z.string().uuid(),
})

const InvoiceStatusSchema = z.enum(['paid', 'pending', 'overdue', 'cancelled'])

export const InvoiceListItemSchema = z.object({
  id: z.string(),
  issuedAt: z.string(),
  total: z.number(),
  currency: z.string(),
  status: InvoiceStatusSchema,
  documentId: z.string().nullable(),
})

export const InvoiceListResponseSchema = z.object({
  items: z.array(InvoiceListItemSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
})

export const InvoiceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
})
