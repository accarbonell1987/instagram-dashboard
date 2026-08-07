import type { Prisma } from '../generated/prisma/client.js';

// ============================================================
// ENUMS
// ============================================================

export type UserRole = 'SuperAdmin' | 'TenantAdmin' | 'User';

export type UserStatus = 'pending_first_login' | 'active' | 'suspended';

export type TenantStatus = 'pending' | 'active' | 'suspended';

export type OtpChannel = 'email' | 'sms';

export type OtpPurpose = 'login' | 'first-login' | 'signup-rep' | 'recover' | 'invitation';

export type DraftStatus =
  | 'draft'
  | 'otp_pending'
  | 'otp_verified'
  | 'payment_pending'
  | 'payment_confirmed'
  | 'completed'
  | 'expired'
  | 'abandoned';

export type DraftStep = 'product' | 'plan' | 'representative' | 'otp' | 'company' | 'payment' | 'summary';

export type PaymentStatus = 'pending' | 'in_review' | 'approved' | 'declined' | 'cancelled' | 'reversed';

export type PaymentMethod = 'bancard' | 'bank_transfer';

export type PaymentSettlementKind = 'gateway_webhook' | 'agent_review' | 'manual_admin';

export type DocumentType = 'invoice' | 'contract' | 'receipt';

export type DocumentStatus = 'pending' | 'ready' | 'failed';

// ============================================================
// DOMAIN INTERFACES
// ============================================================

// The modules a plan grants, resolved live from PlanModule — this is what the
// public plan listing advertises, instead of the hand-written `features` copy.
export interface PlanModuleSummary {
  id: string;
  name: string;
  description: string | undefined;
  parentId: string | null;
}

export interface Plan {
  id: string;
  name: string;
  description: string | undefined;
  price: number;
  currency: string;
  billingInterval: string;
  maxUsers: number;
  features: Record<string, unknown>;
  // The product this plan sells. Only modules of the same product can be
  // attached to it (enforced in ModuleRepository.setPlanModules).
  productId: string | null;
  modules: PlanModuleSummary[];
  // Backoffice ordering (drag and drop) and the product's default plan.
  displayOrder: number;
  isDefault: boolean;
  popular: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  schemaName: string;
  planId: string;
  status: TenantStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string | undefined;
  role: UserRole;
  fullName: string | undefined;
  phone: string | undefined;
  picture: string | undefined;
  status: UserStatus;
  failedLoginAttempts: number;
  lockedUntil: Date | undefined;
  activationTokenHash: string | undefined;
  activationTokenExpiresAt: Date | undefined;
  activationTokenUsed: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | undefined;
}

export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  parentId: string | undefined;
  usedAt: Date | undefined;
  expiresAt: Date;
  createdAt: Date;
}

export interface DeviceTrust {
  id: string;
  userId: string;
  deviceHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface OtpCode {
  id: string;
  identifier: string;
  channel: OtpChannel;
  purpose: OtpPurpose;
  codeHash: string;
  attempts: number;
  used: boolean;
  lockedUntil: Date | undefined;
  expiresAt: Date;
  createdAt: Date;
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  used: boolean;
  expiresAt: Date;
  createdAt: Date;
}

export interface OnboardingDraft {
  id: string;
  status: DraftStatus;
  currentStep: DraftStep;
  version: number;
  planId: string | undefined;
  productId?: string | undefined;
  data: Record<string, unknown>;
  representativeEmail: string | undefined;
  resumeTokenHash: string | undefined;
  resumeTokenExpiresAt: Date | undefined;
  resumeTokenUsed: boolean;
  tenantId: string | undefined;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: string;
  draftId: string;
  tenantId: string | undefined;
  externalRef: string;
  method: PaymentMethod;
  amount: number;
  currency: string;
  status: PaymentStatus;
  reason: string | undefined;
  settlementKind: PaymentSettlementKind | undefined;
  settledBy: string | undefined;
  settledAt: Date | undefined;
  note: string | undefined;
  initiatedAt: Date;
  confirmedAt: Date | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentMethodConfig {
  method: PaymentMethod;
  enabled: boolean;
  displayName: string;
  config: Record<string, unknown>;
  updatedBy: string | undefined;
  updatedAt: Date;
}

export interface WebhookEvent {
  id: string;
  source: 'bancard';
  processId: string;
  status: string;
  rawBody: Record<string, unknown>;
  processedAt: Date;
  createdAt: Date;
}

export interface IdempotencyRecord {
  key: string;
  requestHash: string;
  responseStatus: number;
  responseBody: Record<string, unknown>;
  responseHeaders: Record<string, unknown> | undefined;
  expiresAt: Date;
  createdAt: Date;
}

export interface Invitation {
  id: string;
  email: string;
  tenantId: string;
  inviterUserId: string | undefined;
  role: UserRole;
  tokenHash: string;
  usedAt: Date | undefined;
  revokedAt: Date | undefined;
  expiresAt: Date;
  createdAt: Date;
}

export interface Document {
  id: string;
  tenantId: string;
  type: DocumentType;
  storageKey: string;
  status: DocumentStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Bootstrap Product (owner decision #5, design "Backfill scope"): the only
// product today. Used by the a2 backfill and admin write-path sync until
// multi-product declaration (phase e) exists.
export const DEFAULT_PRODUCT_ID = 'instagram-dashboard'

// b1 (owner-confirmed #1677): default trial length; admins can override per
// grant.
export const DEFAULT_TRIAL_DURATION_DAYS = 14

export type Module = {
  id: string
  name: string
  description: string | undefined
  defaultUrl: string
  active: boolean
  productId: string | null
  parentId: string | null
}

// A product the tenant can reach, with the modules it effectively grants.
// Backs the portal landing: products first, modules inside each one.
export type AvailableProduct = {
  id: string
  name: string
  description: string | undefined
  // The product's own address — where the hub navigates to open it. Absent
  // for a product that hasn't been given one yet.
  defaultUrl: string | undefined
}

export type AvailableProductWithModules = AvailableProduct & {
  modules: EffectiveModule[]
}

export type EffectiveModule = Module & {
  effectiveUrl: string
  // a3: 'trial' added — grant Entitlements surface their real source (see
  // design "source gains a trial value for free").
  source: 'plan' | 'override' | 'trial' | 'admin'
}

// c1 (7.2, PR8): per-product roles, layered over the global UserRole enum —
// see design "Per-Product Roles / JWT". `key` is the stable identifier c2's
// JWT claim will use (not the UUID `id`).
export interface ProductRole {
  id: string
  productId: string
  key: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export interface UserProductRole {
  userId: string
  productRoleId: string
  assignedBy: string | undefined
  createdAt: Date
}

// ============================================================
// CONTEXT TYPES
// ============================================================

export interface TenantContext {
  prisma: Prisma.TransactionClient;
  tenantSlug: string;
}

export interface Session {
  accessToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  role: UserRole;
  user: {
    id: string;
    email: string;
    fullName: string;
    picture: string | undefined;
    role: UserRole;
    status: UserStatus;
  };
  tenant: {
    id: string;
    slug: string;
    name: string;
    planId: string;
    status: TenantStatus;
  };
}
