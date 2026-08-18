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

// Plain pagination. It was named after the invoice list it first served;
// that list is gone and the payment log is the only caller.
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
})
