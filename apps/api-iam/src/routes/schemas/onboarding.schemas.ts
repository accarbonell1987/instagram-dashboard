import { z } from '@hono/zod-openapi';
import { SessionSchema } from './auth.schemas.js';
import { PlanSchema } from './plans.schemas.js';

export const PlanInDraftSchema = PlanSchema.nullable();

export const DraftRepresentativeSchema = z.object({
  email: z.string().email().optional(),
  fullName: z.string().optional(),
  phone: z.string().optional(),
});

export const DraftCompanySchema = z.object({
  name: z.string().optional(),
  slug: z.string().optional(),
  legalName: z.string().optional(),
  ruc: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

export const DraftPaymentSchema = z.object({
  paymentId: z.string(),
  status: z.enum(['pending', 'approved', 'declined', 'cancelled', 'timeout']),
  bancardProcessId: z.string(),
});

export const DraftStateSchema = z.object({
  id: z.string(),
  currentStep: z.enum(['plan', 'representative', 'otp', 'company', 'payment', 'summary']),
  status: z.enum([
    'draft',
    'otp_pending',
    'otp_verified',
    'payment_pending',
    'payment_confirmed',
    'completed',
    'expired',
    'abandoned',
  ]),
  version: z.number().int(),
  plan: PlanInDraftSchema,
  representative: DraftRepresentativeSchema.nullable(),
  otpVerified: z.boolean(),
  company: DraftCompanySchema.nullable(),
  payment: DraftPaymentSchema.nullable(),
  expiresAt: z.string(),
});

export const CreateDraftRequestSchema = z.object({
  planId: z.string().nullable().optional(),
});

// UpdateDraftRequest — root-level step-specific fields matching the contract (DraftUpdateRequest)
// Each step sends its payload at the root of the body alongside step + version.
export const UpdateDraftRequestSchema = z.object({
  step: z.enum(['plan', 'representative', 'otp', 'company', 'payment', 'summary']),
  version: z.number().int(),
  plan: z
    .object({
      id: z.string(),
      name: z.string().optional(),
      price: z.number().optional(),
      currency: z.string().optional(),
      billingCycle: z.string().optional(),
      features: z.array(z.string()).optional(),
      popular: z.boolean().optional(),
    })
    .optional(),
  representative: DraftRepresentativeSchema.optional(),
  company: DraftCompanySchema.optional(),
});

export const RecoverDraftRequestSchema = z.object({
  step: z.enum(['company']),
});

export const ResumeTokenResolutionSchema = z.object({
  draftId: z.string(),
});

// The `email` field is accepted for compatibility but intentionally ignored by the handler.
// The backend always sends the resume link to `representativeEmail` stored in the draft
// for security — trusting an email from the request body would allow link hijacking.
export const ResumeLinkRequestSchema = z.object({
  email: z.string().email().optional(),
});

export const ResumeLinkResponseSchema = z.object({
  sent: z.literal(true),
});

export const PaymentInitiateRequestSchema = z.object({
  planId: z.string().optional(),
});

export const PaymentInitiateResponseSchema = z.object({
  paymentId: z.string(),
  redirectUrl: z.string(),
  expiresAt: z.string(),
});

export const PaymentStatusSchema = z.object({
  paymentId: z.string(),
  status: z.enum(['pending', 'approved', 'declined', 'cancelled', 'timeout']),
  reason: z.string().nullable().optional(),
  confirmedAt: z.string().nullable().optional(),
});

// Bug 9 fix: return document IDs instead of pre-signed URLs (which expired after 300s).
// The hub uses GET /billing/documents/{id}/signed-url to fetch a fresh URL on demand.
export const SubmitDocumentsSchema = z.object({
  invoiceId: z.string(),
  contractId: z.string(),
});

export const SubmitResponseSchema = z.object({
  tenantId: z.string(),
  tenant: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
  }),
  accessToken: z.string(),
  expiresIn: z.number(),
  documents: SubmitDocumentsSchema,
  session: SessionSchema.optional(),
});
