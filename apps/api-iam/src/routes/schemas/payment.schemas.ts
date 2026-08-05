import { z } from '@hono/zod-openapi'

export const PaymentMethodKindSchema = z.enum(['bancard', 'bank_transfer'])

export const PaymentSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  tenantName: z.string().optional(),
  method: PaymentMethodKindSchema,
  status: z.enum(['pending', 'approved', 'declined', 'cancelled', 'timeout']),
  settlementKind: z.enum(['webhook', 'agent', 'manual_admin']).nullable(),
  reference: z.string().nullable(),
  amount: z.number(),
  currency: z.string(),
  note: z.string().nullable(),
  settledBy: z.string().nullable(),
  settledAt: z.string().nullable(),
  instruction: z.null(),
  createdAt: z.string(),
})

export type SchemaPayment = z.infer<typeof PaymentSchema>

export const PaymentListResponseSchema = z.object({
  items: z.array(PaymentSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
})

export const AdminPaymentListQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'declined', 'cancelled', 'timeout']).optional(),
  tenantId: z.string().optional(),
  reference: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const TenantPaymentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const PaymentParamsSchema = z.object({
  id: z.string(),
})

// note is deliberately not `.min(1)` here — an empty/missing note must
// surface as the service's own 422 ValidationError (mandatory-note check in
// settlement.service.ts), not a generic 400 from schema validation.
export const PaymentNoteRequestSchema = z.object({
  note: z.string().optional(),
})

export const PaymentMethodConfigSchema = z.object({
  method: PaymentMethodKindSchema,
  enabled: z.boolean(),
})

export const PaymentMethodConfigListResponseSchema = z.object({
  items: z.array(PaymentMethodConfigSchema),
})

export const PaymentMethodParamsSchema = z.object({
  method: PaymentMethodKindSchema,
})

export const PaymentMethodUpdateRequestSchema = z.object({
  enabled: z.boolean(),
})
