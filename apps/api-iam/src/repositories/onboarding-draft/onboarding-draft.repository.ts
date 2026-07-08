import type { PrismaClient, Prisma } from '../../generated/prisma/client.js';
import { NotFoundError } from '../../errors.js';
import type { OnboardingDraft } from '../../domain/index.js';
import type { CreateDraftInput, UpdateDraftInput, OnboardingDraftRepository } from './types.js';

function mapDraft(raw: {
  id: string;
  status: string;
  currentStep: string;
  version: number;
  planId: string | null;
  data: unknown;
  representativeEmail: string | null;
  resumeTokenHash: string | null;
  resumeTokenExpiresAt: Date | null;
  resumeTokenUsed: boolean;
  tenantId: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): OnboardingDraft {
  return {
    id: raw.id,
    status: raw.status as OnboardingDraft['status'],
    currentStep: raw.currentStep as OnboardingDraft['currentStep'],
    version: raw.version,
    planId: raw.planId ?? undefined,
    data: raw.data as Record<string, unknown>,
    representativeEmail: raw.representativeEmail ?? undefined,
    resumeTokenHash: raw.resumeTokenHash ?? undefined,
    resumeTokenExpiresAt: raw.resumeTokenExpiresAt ?? undefined,
    resumeTokenUsed: raw.resumeTokenUsed,
    tenantId: raw.tenantId ?? undefined,
    expiresAt: raw.expiresAt,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export class PrismaOnboardingDraftRepository implements OnboardingDraftRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateDraftInput): Promise<OnboardingDraft> {
    const raw = await this.prisma.onboardingDraft.create({
      data: {
        planId: data.planId ?? null,
        expiresAt: data.expiresAt,
      },
    });
    return mapDraft(raw);
  }

  async findById(id: string): Promise<OnboardingDraft | null> {
    const raw = await this.prisma.onboardingDraft.findUnique({ where: { id } });
    return raw ? mapDraft(raw) : null;
  }

  async findByRepresentativeEmail(email: string): Promise<OnboardingDraft | null> {
    const raw = await this.prisma.onboardingDraft.findFirst({
      where: { representativeEmail: email },
      orderBy: { createdAt: 'desc' },
    });
    return raw ? mapDraft(raw) : null;
  }

  async findByIdOrThrow(id: string): Promise<OnboardingDraft> {
    const raw = await this.prisma.onboardingDraft.findUnique({ where: { id } });
    if (!raw) throw new NotFoundError('onboarding.draft_not_found');
    return mapDraft(raw);
  }

  async findByIdForUpdate(id: string, tx: Prisma.TransactionClient): Promise<OnboardingDraft> {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        status: string;
        current_step: string;
        version: number;
        plan_id: string | null;
        data: unknown;
        representative_email: string | null;
        resume_token_hash: string | null;
        resume_token_expires_at: Date | null;
        resume_token_used: boolean;
        tenant_id: string | null;
        expires_at: Date;
        created_at: Date;
        updated_at: Date;
      }>
    >`
      SELECT id, status, current_step, version, plan_id, data, representative_email,
             resume_token_hash, resume_token_expires_at, resume_token_used,
             tenant_id, expires_at, created_at, updated_at
      FROM onboarding_drafts
      WHERE id = ${id}::uuid
      FOR UPDATE
    `;
    const [row] = rows;
    if (!row) throw new NotFoundError('onboarding.draft_not_found');
    return {
      id: row.id,
      status: row.status as OnboardingDraft['status'],
      currentStep: row.current_step as OnboardingDraft['currentStep'],
      version: row.version,
      planId: row.plan_id ?? undefined,
      data: row.data as Record<string, unknown>,
      representativeEmail: row.representative_email ?? undefined,
      resumeTokenHash: row.resume_token_hash ?? undefined,
      resumeTokenExpiresAt: row.resume_token_expires_at ?? undefined,
      resumeTokenUsed: row.resume_token_used,
      tenantId: row.tenant_id ?? undefined,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async update(
    id: string,
    data: UpdateDraftInput,
    tx?: Prisma.TransactionClient
  ): Promise<OnboardingDraft> {
    const client = tx ?? this.prisma;
    const updateData: Prisma.OnboardingDraftUncheckedUpdateInput = {};
    if (data.data !== undefined) updateData.data = data.data as Prisma.InputJsonValue;
    if (data.currentStep !== undefined) updateData.currentStep = data.currentStep;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.version !== undefined) updateData.version = data.version;
    if (data.planId !== undefined) updateData.planId = data.planId;
    if (data.representativeEmail !== undefined)
      updateData.representativeEmail = data.representativeEmail;
    if (data.tenantId !== undefined) updateData.tenantId = data.tenantId;
    const raw = await client.onboardingDraft.update({ where: { id }, data: updateData });
    return mapDraft(raw);
  }

  async setResumeToken(id: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.prisma.onboardingDraft.update({
      where: { id },
      data: { resumeTokenHash: tokenHash, resumeTokenExpiresAt: expiresAt, resumeTokenUsed: false },
    });
  }

  async markResumeTokenUsed(id: string): Promise<void> {
    await this.prisma.onboardingDraft.update({
      where: { id },
      data: { resumeTokenUsed: true },
    });
  }

  async deleteExpired(): Promise<number> {
    const result = await this.prisma.onboardingDraft.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
        status: { notIn: ['completed'] },
      },
    });
    return result.count;
  }

  async findByRuc(ruc: string, excludeDraftId?: string): Promise<OnboardingDraft | null> {
    const excludeClause = excludeDraftId ? `AND id != '${excludeDraftId}'` : '';
    const sql = `
      SELECT id, status, current_step, version, plan_id, data, representative_email,
             resume_token_hash, resume_token_expires_at, resume_token_used,
             tenant_id, expires_at, created_at, updated_at
      FROM onboarding_drafts
      WHERE data->'company'->>'ruc' = '${ruc}'
        AND status NOT IN ('completed', 'expired')
        ${excludeClause}
      LIMIT 1
    `;
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        status: string;
        current_step: string;
        version: number;
        plan_id: string | null;
        data: unknown;
        representative_email: string | null;
        resume_token_hash: string | null;
        resume_token_expires_at: Date | null;
        resume_token_used: boolean;
        tenant_id: string | null;
        expires_at: Date;
        created_at: Date;
        updated_at: Date;
      }>
    >(sql);
    const [row] = rows;
    if (!row) return null;
    return mapDraft({
      id: row.id,
      status: row.status,
      currentStep: row.current_step,
      version: row.version,
      planId: row.plan_id,
      data: row.data,
      representativeEmail: row.representative_email,
      resumeTokenHash: row.resume_token_hash,
      resumeTokenExpiresAt: row.resume_token_expires_at,
      resumeTokenUsed: row.resume_token_used,
      tenantId: row.tenant_id,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
