// ─── Role ────────────────────────────────────────────────

export type Role = 'SuperAdmin' | 'TenantAdmin' | 'User';

// ─── User ────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  fullName: string;
  picture?: string | null;
}

// ─── Tenant ──────────────────────────────────────────────

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  planId: string;
  status: 'pending' | 'active' | 'suspended';
}

// ─── Session ─────────────────────────────────────────────

export interface Session {
  accessToken: string;
  expiresIn: number;
  user: User;
  tenant: Tenant;
  role: Role;
}

// ─── Plan ────────────────────────────────────────────────

export interface Plan {
  id: 'starter' | 'professional' | 'enterprise';
  name: string;
  price: number;
  currency: 'PYG' | 'USD';
  billingCycle: 'monthly' | 'yearly';
  features: string[];
  popular?: boolean;
}

// ─── Draft ───────────────────────────────────────────────

export type DraftStatus =
  | 'draft'
  | 'otp_pending'
  | 'otp_verified'
  | 'payment_pending'
  | 'payment_confirmed'
  | 'completed'
  | 'expired'
  | 'abandoned';

export type DraftStep = 'plan' | 'representative' | 'otp' | 'company' | 'payment' | 'summary';

export interface DraftRepresentative {
  email?: string;
  fullName?: string;
  phone?: string;
}

export interface DraftCompany {
  legalName?: string;
  ruc?: string;
  address?: string;
  city?: string;
  country?: string;
}

export interface DraftPayment {
  paymentId?: string;
  status?: 'pending' | 'approved' | 'declined' | 'cancelled' | 'timeout';
  bancardProcessId?: string;
}

export interface DraftState {
  id: string;
  currentStep: DraftStep;
  status: DraftStatus;
  plan?: Plan | null;
  representative?: DraftRepresentative | null;
  otpVerified?: boolean;
  company?: DraftCompany | null;
  payment?: DraftPayment | null;
  version: number;
  expiresAt: string;
}

export interface DraftUpdateRequest {
  step: DraftStep;
  version: number;
  plan?: Plan | null;
  representative?: DraftRepresentative | null;
  company?: DraftCompany | null;
}

// ─── Payment ─────────────────────────────────────────────

export interface PaymentInitiateResponse {
  paymentId: string;
  redirectUrl: string;
  expiresAt: string;
}

export interface PaymentStatus {
  paymentId: string;
  status: 'pending' | 'approved' | 'declined' | 'cancelled' | 'timeout';
  reason?: string | null;
  confirmedAt?: string | null;
}

export interface SubmitResponse {
  tenantId: string;
  tenant?: Tenant;
  accessToken: string;
  expiresIn?: number;
  // Bug 9 fix: backend now returns document IDs for on-demand signed URL generation
  documents: {
    invoiceId: string;
    contractId: string;
  };
}

// ─── Invitation ──────────────────────────────────────────

export interface InvitationPreview {
  email: string;
  tenantName: string;
  inviterName?: string;
  role: Role;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
}

// id is the token — required by createService<T extends { id: string | number }>
export type Invitation = { id: string } & InvitationPreview;

// ─── Billing ─────────────────────────────────────────────

export interface BillingDocument {
  id: string;
}

export interface SignedUrlResponse {
  url: string;
  expiresAt: string;
}
