import type { PrismaClient } from '../generated/prisma/client.js'
import { PrismaUserRepository } from './user/index.js'
import { PrismaTenantRepository } from './tenant/index.js'
import { PrismaPlanRepository } from './plan/index.js'
import { PrismaRefreshTokenRepository } from './refresh-token/index.js'
import { PrismaDeviceTrustRepository } from './device-trust/index.js'
import { PrismaOtpCodeRepository } from './otp-code/index.js'
import { PrismaPasswordResetTokenRepository } from './password-reset-token/index.js'
import { PrismaOnboardingDraftRepository } from './onboarding-draft/index.js'
import { PrismaPaymentRepository } from './payment/index.js'
import { PrismaWebhookEventRepository } from './webhook-event/index.js'
import { PrismaIdempotencyRepository } from './idempotency/index.js'
import { PrismaInvitationRepository } from './invitation/index.js'
import { PrismaDocumentRepository } from './document/index.js'
import { PrismaPlanChangeRepository } from './plan-change/index.js'
import { createModuleRepository } from './module/index.js'
import { createQuizRepository } from './quiz/index.js'
import { createQuizAttemptRepository } from './quiz-attempt/index.js'
import { PrismaPlanQuotaRepository } from './plan-quota/index.js'

export type { UserRepository, CreateUserInput } from './user/index.js'
export type { TenantRepository, CreateTenantInput } from './tenant/index.js'
export type { PlanRepository, PlanWithTenantCount, CreatePlanInput, UpdatePlanInput, PlanListFilter } from './plan/index.js'
export type { RefreshTokenRepository, CreateRefreshTokenInput } from './refresh-token/index.js'
export type { DeviceTrustRepository } from './device-trust/index.js'
export type { OtpCodeRepository, CreateOtpCodeInput } from './otp-code/index.js'
export type { PasswordResetTokenRepository } from './password-reset-token/index.js'
export type { OnboardingDraftRepository, CreateDraftInput, UpdateDraftInput } from './onboarding-draft/index.js'
export type { PaymentRepository, CreatePaymentInput } from './payment/index.js'
export type { WebhookEventRepository } from './webhook-event/index.js'
export type { IdempotencyRepository, CreateIdempotencyInput } from './idempotency/index.js'
export type { InvitationRepository, CreateInvitationInput, InvitationStatus, RawInvitationRow } from './invitation/index.js'
export type { DocumentRepository, CreateDocumentInput } from './document/index.js'
export type { PlanChangeRepository, CreatePlanChangeInput, PlanChangeRepositoryItem } from './plan-change/index.js'
export type { ModuleRepository } from './module/index.js'
export type { QuizRepository } from './quiz/index.js'
export type { QuizAttemptRepository } from './quiz-attempt/index.js'
export type { PlanQuotaRepository, PlanQuotaData, CreatePlanQuotaInput, UpsertPlanQuotaInput } from './plan-quota/index.js'

export {
  PrismaUserRepository,
  PrismaTenantRepository,
  PrismaPlanRepository,
  PrismaRefreshTokenRepository,
  PrismaDeviceTrustRepository,
  PrismaOtpCodeRepository,
  PrismaPasswordResetTokenRepository,
  PrismaOnboardingDraftRepository,
  PrismaPaymentRepository,
  PrismaWebhookEventRepository,
  PrismaIdempotencyRepository,
  PrismaInvitationRepository,
  PrismaDocumentRepository,
  PrismaPlanChangeRepository,
  PrismaPlanQuotaRepository,
}

export function createRepositories(prisma: PrismaClient) {
  return {
    userRepo: new PrismaUserRepository(prisma),
    tenantRepo: new PrismaTenantRepository(prisma),
    planRepo: new PrismaPlanRepository(prisma),
    refreshTokenRepo: new PrismaRefreshTokenRepository(prisma),
    deviceTrustRepo: new PrismaDeviceTrustRepository(prisma),
    otpCodeRepo: new PrismaOtpCodeRepository(prisma),
    passwordResetTokenRepo: new PrismaPasswordResetTokenRepository(prisma),
    draftRepo: new PrismaOnboardingDraftRepository(prisma),
    paymentRepo: new PrismaPaymentRepository(prisma),
    webhookEventRepo: new PrismaWebhookEventRepository(prisma),
    idempotencyRepo: new PrismaIdempotencyRepository(prisma),
    invitationRepo: new PrismaInvitationRepository(prisma),
    documentRepo: new PrismaDocumentRepository(prisma),
    planChangeRepo: new PrismaPlanChangeRepository(prisma),
    moduleRepository: createModuleRepository(prisma),
    quizRepository: createQuizRepository(prisma),
    quizAttemptRepository: createQuizAttemptRepository(prisma),
    planQuotaRepo: new PrismaPlanQuotaRepository(prisma),
  }
}

export type Repositories = ReturnType<typeof createRepositories>
