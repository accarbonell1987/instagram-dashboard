import { z } from '@hono/zod-openapi'

export const PaymentMethodKindSchema = z.enum(['bancard', 'bank_transfer'])

export const BankAccountSchema = z.object({
  bankName: z.string(),
  accountType: z.enum(['checking', 'savings']),
  accountNumber: z.string(),
  accountHolder: z.string(),
})

export const RedirectPaymentInstructionSchema = z.object({
  kind: z.literal('redirect'),
  redirectUrl: z.string(),
  expiresAt: z.string(),
})

export const BankTransferPaymentInstructionSchema = z.object({
  kind: z.literal('bank_transfer'),
  reference: z.string(),
  bankAccounts: z.array(BankAccountSchema),
})

export const PaymentInstructionSchema = z.union([
  RedirectPaymentInstructionSchema,
  BankTransferPaymentInstructionSchema,
])

export const PaymentSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  tenantName: z.string().optional(),
  method: PaymentMethodKindSchema,
  status: z.enum(['pending', 'in_review', 'approved', 'declined', 'cancelled', 'timeout']),
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
  status: z.enum(['pending', 'in_review', 'approved', 'declined', 'cancelled', 'timeout']).optional(),
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

// The contract declares note required with minLength 1, and that is the correct
// description of the business rule. This schema stays permissive on purpose:
// validation here is structural, and the mandatory-note rule is a domain rule
// that settlement.service.ts owns and reports as a typed 422
// `payment.note_required` in application/problem+json.
//
// Tightening this to .min(1) makes @hono/zod-openapi reject the request before
// the handler runs, and with no defaultHook configured anywhere in this service
// that surfaces as a bare 400 that skips errorHandler — breaking the project
// rule that EVERY error is RFC 7807. Move this only alongside a defaultHook.
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

// Public counterpart of PaymentMethodConfig — no bank-account details, the
// signup wizard is unauthenticated and only needs to know what to offer.
export const PaymentMethodOptionSchema = z.object({
  method: PaymentMethodKindSchema,
  displayName: z.string(),
})

export const PaymentMethodOptionListResponseSchema = z.object({
  items: z.array(PaymentMethodOptionSchema),
})

export const PaymentMethodParamsSchema = z.object({
  method: PaymentMethodKindSchema,
})

export const PaymentMethodUpdateRequestSchema = z.object({
  enabled: z.boolean(),
})
