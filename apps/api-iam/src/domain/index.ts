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

export type DraftStep = 'plan' | 'representative' | 'otp' | 'company' | 'payment' | 'summary';

export type PaymentStatus = 'pending' | 'approved' | 'declined' | 'cancelled' | 'reversed';

export type DocumentType = 'invoice' | 'contract';

export type DocumentStatus = 'pending' | 'ready' | 'failed';

// ============================================================
// DOMAIN INTERFACES
// ============================================================

export interface Plan {
  id: string;
  name: string;
  description: string | undefined;
  price: number;
  currency: string;
  billingInterval: string;
  maxUsers: number;
  features: Record<string, unknown>;
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
  bancardProcessId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  reason: string | undefined;
  initiatedAt: Date;
  confirmedAt: Date | undefined;
  createdAt: Date;
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

export type Module = {
  id: string
  name: string
  description: string | undefined
  defaultUrl: string
  active: boolean
}

export type EffectiveModule = Module & {
  effectiveUrl: string
  source: 'plan' | 'override' | 'admin'
}

// ============================================================
// QUIZ TYPES
// ============================================================

export type QuestionType = 'multiple_choice' | 'true_false';

export type AttemptStatus = 'in_progress' | 'completed' | 'abandoned';

export interface Quiz {
  id: string;
  moduleId: string | undefined;
  title: string;
  description: string | undefined;
  passingScore: number;
  timeLimitMinutes: number | undefined;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Question {
  id: string;
  quizId: string;
  text: string;
  type: QuestionType;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionOption {
  id: string;
  questionId: string;
  text: string;
  isCorrect: boolean;
  order: number;
  createdAt: Date;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  tenantId: string;
  userId: string;
  score: number | undefined;
  passed: boolean | undefined;
  status: AttemptStatus;
  startedAt: Date;
  completedAt: Date | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizAttemptAnswer {
  id: string;
  attemptId: string;
  questionId: string;
  selectedOptionId: string | undefined;
  createdAt: Date;
}

export type QuizWithQuestions = Quiz & {
  questions: (Question & { options: QuestionOption[] })[];
};

export type QuizAttemptWithAnswers = QuizAttempt & {
  quiz?: Quiz;
  answers: (QuizAttemptAnswer & {
    question?: Question & { options: QuestionOption[] };
    selectedOption?: QuestionOption | null;
  })[];
};

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
