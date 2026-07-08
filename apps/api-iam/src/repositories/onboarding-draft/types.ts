import type { Prisma } from '../../generated/prisma/client.js';
import type { OnboardingDraft, DraftStatus, DraftStep } from '../../domain/index.js';

export interface CreateDraftInput {
  planId?: string | undefined;
  expiresAt: Date;
}

export interface UpdateDraftInput {
  data?: Record<string, unknown> | undefined;
  currentStep?: DraftStep | undefined;
  status?: DraftStatus | undefined;
  version?: number | undefined;
  planId?: string | undefined;
  representativeEmail?: string | undefined;
  otpId?: string | undefined;
  paymentId?: string | undefined;
  tenantId?: string | undefined;
}

export interface OnboardingDraftRepository {
  create(data: CreateDraftInput): Promise<OnboardingDraft>;
  findById(id: string): Promise<OnboardingDraft | null>;
  findByIdOrThrow(id: string): Promise<OnboardingDraft>;
  findByIdForUpdate(id: string, tx: Prisma.TransactionClient): Promise<OnboardingDraft>;
  findByRepresentativeEmail(email: string): Promise<OnboardingDraft | null>;
  update(
    id: string,
    data: UpdateDraftInput,
    tx?: Prisma.TransactionClient
  ): Promise<OnboardingDraft>;
  setResumeToken(id: string, tokenHash: string, expiresAt: Date): Promise<void>;
  markResumeTokenUsed(id: string): Promise<void>;
  deleteExpired(): Promise<number>;
  findByRuc(ruc: string, excludeDraftId?: string): Promise<OnboardingDraft | null>;
}
