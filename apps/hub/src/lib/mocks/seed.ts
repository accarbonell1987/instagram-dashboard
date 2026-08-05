import { db, resetDb } from './db';
import { setActiveScenario } from './scenarios/index';
import type { Scenario } from './scenarios/index';
import { stablePast, stableFuture } from './seed-utils';

// ─── Stable IDs ──────────────────────────────────────────────────────────────

export const SEED = {
  userId: 'user-0001-0000-0000-000000000001',
  userActiveMemberId: 'user-0002-0000-0000-000000000002',
  userSuspendedMemberId: 'user-0003-0000-0000-000000000003',
  userPendingMemberId: 'user-0004-0000-0000-000000000004',
  tenantId: 'tenant-001-0000-0000-000000000001',
  tenantSlug: 'acme',
  invitationToken: 'mock-invitation-token-happy',
  invitationExpiredToken: 'mock-invitation-token-expired',
  planStarter: 'starter',
  planProfessional: 'professional',
  planEnterprise: 'enterprise',
  resumeToken: 'mock-resume-token-happy',
  invoiceIds: [
    'inv-001-paid-0000-0000-000000000001',
    'inv-002-paid-0000-0000-000000000002',
    'inv-003-pending-000-0000-000000000003',
    'inv-004-overdue-00-0000-000000000004',
    'inv-005-cancelled-0-0000-000000000005',
  ] as const,
  invoiceDocIds: [
    'doc-inv-001-0000-0000-000000000001',
    'doc-inv-002-0000-0000-000000000002',
  ] as const,
  paymentIds: [
    'pay-001-approved-0-0000-000000000001',
    'pay-002-pending-00-0000-000000000002',
    'pay-003-declined-0-0000-000000000003',
  ] as const,
} as const;

// ─── Base seed ───────────────────────────────────────────────────────────────

// Mirrors the api-iam plan-module assignments (see apps/api-iam/src/db/seed.ts).
const IG_METRICS = {
  id: 'ig-basic-metrics',
  name: 'Métricas Básicas',
  description: 'Panel de métricas, crecimiento y demografía de tu cuenta',
  subModules: [],
};
const IG_PUBLICATIONS = {
  id: 'ig-publications',
  name: 'Publicaciones',
  description: 'Gestioná y analizá tus publicaciones, reels e historias',
  subModules: [],
};
const IG_AI_AGENT = {
  id: 'ig-ai-agent',
  name: 'Agente IA',
  description: 'Asistente inteligente para crecer en Instagram',
  subModules: [
    { id: 'ig-ai-chat', name: 'Chat - Agente de Crecimiento' },
    { id: 'ig-ai-suggestions', name: 'Sugerencias de Contenido' },
    { id: 'ig-ai-carousels', name: 'Carousels - Creación con IA' },
  ],
};

function seedPlans(): void {
  db.plan.create({
    id: SEED.planStarter,
    name: 'Básico',
    price: 150_000,
    currency: 'PYG',
    billingCycle: 'monthly',
    features: ['Hasta 5 usuarios', 'Soporte email'],
    modules: [IG_METRICS],
    popular: false,
  });
  db.plan.create({
    id: SEED.planProfessional,
    name: 'Profesional',
    price: 450_000,
    currency: 'PYG',
    billingCycle: 'monthly',
    features: ['Hasta 25 usuarios', 'Soporte 24/5'],
    modules: [IG_METRICS, IG_PUBLICATIONS],
    popular: true,
  });
  db.plan.create({
    id: SEED.planEnterprise,
    name: 'Enterprise',
    price: 0,
    currency: 'PYG',
    billingCycle: 'monthly',
    features: ['Usuarios ilimitados', 'Soporte dedicado', 'SLA garantizado'],
    modules: [IG_METRICS, IG_PUBLICATIONS, IG_AI_AGENT],
    popular: false,
  });
}

function seedHappyBase(): void {
  seedPlans();

  db.tenant.create({
    id: SEED.tenantId,
    slug: SEED.tenantSlug,
    name: 'Empresa Acme S.A.',
    planId: SEED.planProfessional,
    status: 'active',
    createdAt: stablePast(90 * 24 * 3600), // 90 days ago
    updatedAt: stablePast(7 * 24 * 3600), // 7 days ago
  });

  db.user.create({
    id: SEED.userId,
    email: 'test@corehub.com',
    fullName: 'Ana Pereira',
    picture: null,
    role: 'TenantAdmin',
    tenantId: SEED.tenantId,
    passwordHash: 'hashed:Pass1234!',
    status: 'active',
  });

  seedPaymentMethods();
}

// ─── Scenario seeds ──────────────────────────────────────────────────────────

function seedHappy(): void {
  seedHappyBase();

  // Seed a valid resume token pointing to a pre-created draft for resume-flow tests.
  // The draft itself is created lazily — the token just needs a valid draftId format.
  const resumeDraftId = 'draft-resume-0000-0000-0000-000000000001';
  db.draft.create({
    id: resumeDraftId,
    currentStep: 'company',
    status: 'otp_verified',
    planId: SEED.planProfessional,
    representativeEmail: 'test@corehub.com',
    representativeFullName: 'Ana Pereira',
    representativePhone: '',
    companyLegalName: null,
    companyRuc: null,
    companyAddress: null,
    companyCity: null,
    companyCountry: null,
    otpVerified: true,
    paymentId: null,
    version: 3,
    expiresAt: stableFuture(7 * 24 * 3600),
  });
  db.resumeToken.create({
    token: SEED.resumeToken,
    draftId: resumeDraftId,
    // Use real Date.now() + 7 days so the token is always valid in tests
    expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
    used: false,
  });

  seedAdminData();
  seedInvoices();
  seedPayments();
}

function seedInvoices(): void {
  db.invoice.create({
    id: SEED.invoiceIds[0],
    tenantId: SEED.tenantId,
    issuedAt: stablePast(4 * 30 * 24 * 3600),
    total: 450_000,
    currency: 'PYG',
    status: 'paid',
    documentId: SEED.invoiceDocIds[0],
  });
  db.invoice.create({
    id: SEED.invoiceIds[1],
    tenantId: SEED.tenantId,
    issuedAt: stablePast(3 * 30 * 24 * 3600),
    total: 450_000,
    currency: 'PYG',
    status: 'paid',
    documentId: SEED.invoiceDocIds[1],
  });
  db.invoice.create({
    id: SEED.invoiceIds[2],
    tenantId: SEED.tenantId,
    issuedAt: stablePast(2 * 30 * 24 * 3600),
    total: 450_000,
    currency: 'PYG',
    status: 'pending',
    documentId: null,
  });
  db.invoice.create({
    id: SEED.invoiceIds[3],
    tenantId: SEED.tenantId,
    issuedAt: stablePast(1 * 30 * 24 * 3600),
    total: 450_000,
    currency: 'PYG',
    status: 'overdue',
    documentId: null,
  });
  db.invoice.create({
    id: SEED.invoiceIds[4],
    tenantId: SEED.tenantId,
    issuedAt: stablePast(5 * 30 * 24 * 3600),
    total: 450_000,
    currency: 'PYG',
    status: 'cancelled',
    documentId: null,
  });
}

// Bootstrap matches the api-iam migration seed: bancard stays the only live
// method until bank_transfer is toggled on via the admin backoffice.
function seedPaymentMethods(): void {
  db.paymentMethodConfig.create({ method: 'bancard', enabled: true, displayName: 'Tarjeta (Bancard)' });
  db.paymentMethodConfig.create({ method: 'bank_transfer', enabled: false, displayName: 'Transferencia bancaria' });
}

function seedPayments(): void {
  db.paymentRecord.create({
    id: SEED.paymentIds[0],
    tenantId: SEED.tenantId,
    tenantName: 'Empresa Acme S.A.',
    method: 'bancard',
    status: 'approved',
    settlementKind: 'webhook',
    reference: 'BANCARD-PROC-0001',
    amount: 450_000,
    currency: 'PYG',
    note: null,
    settledBy: null,
    settledAt: stablePast(90 * 24 * 3600),
    createdAt: stablePast(90 * 24 * 3600),
  });
  db.paymentRecord.create({
    id: SEED.paymentIds[1],
    tenantId: SEED.tenantId,
    tenantName: 'Empresa Acme S.A.',
    method: 'bank_transfer',
    status: 'pending',
    settlementKind: null,
    reference: 'CH-7K2M4Q',
    amount: 450_000,
    currency: 'PYG',
    note: null,
    settledBy: null,
    settledAt: null,
    createdAt: stablePast(3 * 24 * 3600),
  });
  db.paymentRecord.create({
    id: SEED.paymentIds[2],
    tenantId: SEED.tenantId,
    tenantName: 'Empresa Acme S.A.',
    method: 'bank_transfer',
    status: 'declined',
    settlementKind: 'agent',
    reference: 'CH-9P3X7T',
    amount: 150_000,
    currency: 'PYG',
    note: 'Referencia no encontrada en el extracto bancario',
    settledBy: SEED.userId,
    settledAt: stablePast(10 * 24 * 3600),
    createdAt: stablePast(11 * 24 * 3600),
  });
}

function seedAdminData(): void {
  // Additional members with different statuses
  db.user.create({
    id: SEED.userActiveMemberId,
    email: 'active.member@corehub.com',
    fullName: 'Carlos Martínez',
    picture: null,
    role: 'User',
    tenantId: SEED.tenantId,
    passwordHash: null,
    status: 'active',
  });
  db.user.create({
    id: SEED.userSuspendedMemberId,
    email: 'suspended.member@corehub.com',
    fullName: 'María López',
    picture: null,
    role: 'User',
    tenantId: SEED.tenantId,
    passwordHash: null,
    status: 'suspended',
  });
  db.user.create({
    id: SEED.userPendingMemberId,
    email: 'pending.member@corehub.com',
    fullName: '',
    picture: null,
    role: 'User',
    tenantId: SEED.tenantId,
    passwordHash: null,
    status: 'pending_first_login',
  });

  // 2 pending invitations
  db.invitation.create({
    id: 'inv-pending-001-000000000001',
    token: 'token-inv-pending-001',
    email: 'pending1@corehub.com',
    tenantId: SEED.tenantId,
    tenantName: 'Empresa Acme S.A.',
    inviterName: 'Ana Pereira',
    role: 'User',
    expiresAt: stableFuture(7 * 24 * 3600),
    usedAt: null,
    revokedAt: null,
    status: 'pending',
  });
  db.invitation.create({
    id: 'inv-pending-002-000000000002',
    token: 'token-inv-pending-002',
    email: 'pending2@corehub.com',
    tenantId: SEED.tenantId,
    tenantName: 'Empresa Acme S.A.',
    inviterName: 'Ana Pereira',
    role: 'TenantAdmin',
    expiresAt: stableFuture(7 * 24 * 3600),
    usedAt: null,
    revokedAt: null,
    status: 'pending',
  });
  // 1 accepted invitation (historical reference)
  db.invitation.create({
    id: 'inv-accepted-001-000000000003',
    token: 'token-inv-accepted-001',
    email: 'accepted@corehub.com',
    tenantId: SEED.tenantId,
    tenantName: 'Empresa Acme S.A.',
    inviterName: 'Ana Pereira',
    role: 'User',
    expiresAt: stableFuture(7 * 24 * 3600),
    usedAt: stablePast(2 * 24 * 3600),
    revokedAt: null,
    status: 'accepted',
  });
}

function seedBillingEmpty(): void {
  seedHappyBase();
  seedAdminData();
  // No invoices seeded — payment method is null (handler checks scenario)
}

function seedOtpFailure(): void {
  // Same base data — OTP failure is handled at request time by reading active scenario
  seedHappyBase();
}

function seedPaymentCancelled(): void {
  seedHappyBase();
}

function seedPaymentTimeout(): void {
  seedHappyBase();
}

function seedSessionExpired(): void {
  seedHappyBase();
}

function seedInvitationExpired(): void {
  seedPlans();

  db.tenant.create({
    id: SEED.tenantId,
    slug: SEED.tenantSlug,
    name: 'Empresa Acme S.A.',
    planId: SEED.planProfessional,
    status: 'active',
    createdAt: stablePast(90 * 24 * 3600),
    updatedAt: stablePast(7 * 24 * 3600),
  });

  db.invitation.create({
    id: 'inv-expired-0001',
    token: SEED.invitationExpiredToken,
    email: 'nuevo@empresa.com',
    tenantId: SEED.tenantId,
    tenantName: 'Empresa Acme S.A.',
    inviterName: 'Ana Pereira',
    role: 'User',
    expiresAt: stablePast(86_400), // expired 1 day ago
    usedAt: null,
    revokedAt: null,
    status: 'expired',
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

const SEED_MAP: Record<Scenario, () => void> = {
  happy: seedHappy,
  'otp-failure': seedOtpFailure,
  'payment-cancelled': seedPaymentCancelled,
  'payment-timeout': seedPaymentTimeout,
  'session-expired': seedSessionExpired,
  'invitation-expired': seedInvitationExpired,
  // invitation-used uses same base — the scenario activates the 409 mock bypass in handlers
  'invitation-used': seedHappy,
  // device-trusted uses the same seed as happy — the scenario activates the mock bypass in handlers
  'device-trusted': seedHappy,
  // billing-empty — no invoices, no payment method (handler checks scenario)
  'billing-empty': seedBillingEmpty,
};

export function seedDb(scenario: Scenario): void {
  // Track active scenario in the module-level state (used by handlers in Node)
  setActiveScenario(scenario);
  resetDb();
  SEED_MAP[scenario]();
}

export function applyScenario(scenario: Scenario): void {
  seedDb(scenario);
}
