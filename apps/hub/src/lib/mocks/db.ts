import { factory, primaryKey, nullable } from '@mswjs/data';

import { clearIdempotencyCache } from './handlers/idempotency-cache';

/**
 * In-memory database powered by @mswjs/data.
 * Models mirror OpenAPI schemas exactly (no envelope).
 * Reset via resetDb() between tests or scenario switches.
 */

 

export const db = factory({
  user: {
    id: primaryKey(String),
    email: String,
    fullName: String,
    picture: nullable(String),
    role: String,
    tenantId: nullable(String),
    passwordHash: nullable(String),
    status: String,
  },

  tenant: {
    id: primaryKey(String),
    slug: String,
    name: String,
    planId: String,
    status: String,
    createdAt: String,
    updatedAt: String,
  },

  plan: {
    id: primaryKey(String),
    name: String,
    price: Number,
    currency: String,
    billingCycle: String,
    features: Array,
    popular: Boolean,
  },

  draft: {
    id: primaryKey(String),
    currentStep: String,
    status: String,
    planId: nullable(String),
    representativeEmail: nullable(String),
    representativeFullName: nullable(String),
    representativePhone: nullable(String),
    companyLegalName: nullable(String),
    companyRuc: nullable(String),
    companyAddress: nullable(String),
    companyCity: nullable(String),
    companyCountry: nullable(String),
    otpVerified: Boolean,
    paymentId: nullable(String),
    version: Number,
    expiresAt: String,
  },

  session: {
    id: primaryKey(String),
    userId: String,
    refreshToken: String,
    expiresAt: String,
  },

  otp: {
    id: primaryKey(String),
    userId: nullable(String),
    code: String,
    expiresAt: Number,
    attempts: Number,
    used: Boolean,
    purpose: String,
  },

  invitation: {
    id: primaryKey(String),
    token: String,
    email: String,
    tenantId: String,
    tenantName: String,
    inviterName: String,
    role: String,
    expiresAt: String,
    usedAt: nullable(String),
    revokedAt: nullable(String),
    status: String,
  },

  payment: {
    id: primaryKey(String),
    draftId: String,
    status: String,
    redirectUrl: String,
    pollCount: Number,
  },

  document: {
    id: primaryKey(String),
    type: String,
    url: String,
    tenantId: String,
  },

  idempotency: {
    key: primaryKey(String),
    status: Number,
    body: Object,
    createdAt: Number,
  },

  resumeToken: {
    token: primaryKey(String),
    draftId: String,
    expiresAt: Number,
    used: Boolean,
  },

  planChangeRequest: {
    id: primaryKey(String),
    tenantId: String,
    requestedBy: String,
    toPlanId: String,
    status: String,
    createdAt: String,
  },

  invoice: {
    id: primaryKey(String),
    tenantId: String,
    issuedAt: String,
    total: Number,
    currency: String,
    status: String,
    documentId: nullable(String),
  },

  paymentMethodChangeRequest: {
    id: primaryKey(String),
    tenantId: String,
    createdAt: String,
    status: String,
  },
});

export type Db = typeof db;

export function resetDb(): void {
  db.user.deleteMany({ where: {} });
  db.tenant.deleteMany({ where: {} });
  db.plan.deleteMany({ where: {} });
  db.draft.deleteMany({ where: {} });
  db.session.deleteMany({ where: {} });
  db.otp.deleteMany({ where: {} });
  db.invitation.deleteMany({ where: {} });
  db.payment.deleteMany({ where: {} });
  db.document.deleteMany({ where: {} });
  db.idempotency.deleteMany({ where: {} });
  db.resumeToken.deleteMany({ where: {} });
  db.planChangeRequest.deleteMany({ where: {} });
  db.invoice.deleteMany({ where: {} });
  db.paymentMethodChangeRequest.deleteMany({ where: {} });
  // Also clear the in-memory idempotency Map (separate from db for performance)
  clearIdempotencyCache();
}
