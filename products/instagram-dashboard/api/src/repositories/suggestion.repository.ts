import { SuggestionStatus, type PrismaClient, type SuggestionCategory, type SuggestionOutcome } from '@prisma/client';

import { NotFoundError } from '../errors.js';
import type { Owner } from '../domain/owner.js';

export type { SuggestionCategory, SuggestionStatus, SuggestionOutcome };

export interface ContentSuggestion {
  id: string;
  tenantId: string;
  userId: string;
  batchId: string | null;
  category: SuggestionCategory;
  content: string;
  status: SuggestionStatus;
  linkedMediaId: string | null;
  linkedAt: Date | null;
  outcome: SuggestionOutcome | null;
  measuredAt: Date | null;
  baselineJson: unknown;
  metricsJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSuggestion {
  tenantId: string;
  userId: string;
  batchId?: string | undefined;
  category: SuggestionCategory;
  content: string;
}

export interface SuggestionBatch {
  id: string;
  tenantId: string;
  userId: string;
  userMessage: string;
  createdAt: Date;
  suggestions: ContentSuggestion[];
}

export interface CreateBatch {
  tenantId: string;
  userId: string;
  userMessage: string;
}

export interface UpdateSuggestion {
  status?: SuggestionStatus | undefined;
  linkedMediaId?: string | undefined;
  linkedAt?: Date | undefined;
  outcome?: SuggestionOutcome | undefined;
  measuredAt?: Date | undefined;
  baselineJson?: unknown;
  metricsJson?: unknown;
}

export interface ISuggestionRepository {
  create(data: CreateSuggestion): Promise<ContentSuggestion>;
  findByOwner(owner: Owner, status?: SuggestionStatus): Promise<ContentSuggestion[]>;
  findById(owner: Owner, id: string): Promise<ContentSuggestion | null>;
  update(owner: Owner, id: string, data: UpdateSuggestion): Promise<ContentSuggestion>;
  findEligibleForMeasurement(): Promise<ContentSuggestion[]>;
  // Batches
  createBatch(data: CreateBatch): Promise<SuggestionBatch>;
  findBatchesByOwner(owner: Owner, page: number, limit: number): Promise<{ batches: SuggestionBatch[]; total: number }>;
}

export class PrismaSuggestionRepository implements ISuggestionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateSuggestion): Promise<ContentSuggestion> {
    const record = await this.prisma.contentSuggestion.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        category: data.category,
        content: data.content,
        ...(data.batchId !== undefined ? { batchId: data.batchId } : {}),
      },
    });
    return this.toDomain(record);
  }

  async findByOwner(owner: Owner, status?: SuggestionStatus): Promise<ContentSuggestion[]> {
    const whereStatus =
      status !== undefined
        ? { status }
        : { status: { not: SuggestionStatus.dismissed } };

    const records = await this.prisma.contentSuggestion.findMany({
      where: { ...owner, ...whereStatus },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findById(owner: Owner, id: string): Promise<ContentSuggestion | null> {
    const record = await this.prisma.contentSuggestion.findFirst({
      where: { ...owner, id },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async update(owner: Owner, id: string, data: UpdateSuggestion): Promise<ContentSuggestion> {
    // `updateMany` with the owner in the WHERE, which is where isolation has to
    // live. It used to sit in `data` under a comment claiming to enforce it, so
    // the update matched on id alone — any member could mark another member's
    // suggestion used or dismissed — and then wrote the caller's tenantId and
    // userId onto the row, quietly moving it to whoever touched it last.
    const updated = await this.prisma.contentSuggestion.updateMany({
      where: { ...owner, id },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.linkedMediaId !== undefined && { linkedMediaId: data.linkedMediaId }),
        ...(data.linkedAt !== undefined && { linkedAt: data.linkedAt }),
        ...(data.outcome !== undefined && { outcome: data.outcome }),
        ...(data.measuredAt !== undefined && { measuredAt: data.measuredAt }),
        ...(data.baselineJson !== undefined && { baselineJson: data.baselineJson as object }),
        ...(data.metricsJson !== undefined && { metricsJson: data.metricsJson as object }),
      },
    });

    // Nothing matched: the id belongs to somebody else, or to nothing. Saying
    // "not found" rather than "forbidden" on purpose — telling a caller that an
    // id exists under another owner is an existence oracle.
    if (updated.count === 0) {
      throw new NotFoundError('suggestion', id);
    }

    const record = await this.prisma.contentSuggestion.findFirstOrThrow({
      where: { ...owner, id },
    });
    return this.toDomain(record);
  }

  async createBatch(data: CreateBatch): Promise<SuggestionBatch> {
    const record = await this.prisma.suggestionBatch.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        userMessage: data.userMessage,
      },
    });
    return {
      id: record.id,
      tenantId: record.tenantId,
      userId: record.userId,
      userMessage: record.userMessage,
      createdAt: record.createdAt,
      suggestions: [],
    };
  }

  async findBatchesByOwner(
    owner: Owner,
    page: number,
    limit: number,
  ): Promise<{ batches: SuggestionBatch[]; total: number }> {
    const [total, records] = await Promise.all([
      this.prisma.suggestionBatch.count({ where: { ...owner } }),
      this.prisma.suggestionBatch.findMany({
        where: { ...owner },
        // The nested read carries the owner too. Filtering the batch alone
        // trusts that every suggestion under it shares its owner — true today,
        // and true only because nothing has broken that assumption yet. A
        // mismatch would hand one member another's list through the panel,
        // which is the one screen that reads suggestions through batches.
        include: {
          suggestions: { where: { ...owner }, orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      total,
      batches: records.map((r) => ({
        id: r.id,
        tenantId: r.tenantId,
        userId: r.userId,
        userMessage: r.userMessage,
        createdAt: r.createdAt,
        suggestions: r.suggestions.map((s) => this.toDomain(s)),
      })),
    };
  }

  async findEligibleForMeasurement(): Promise<ContentSuggestion[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const records = await this.prisma.contentSuggestion.findMany({
      where: {
        status: SuggestionStatus.used,
        linkedMediaId: { not: null },
        measuredAt: null,
        linkedAt: { lt: sevenDaysAgo },
      },
    });
    return records.map((r) => this.toDomain(r));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toDomain(record: Record<string, any>): ContentSuggestion {
    return {
      id: record['id'] as string,
      tenantId: record['tenantId'] as string,
      userId: record['userId'] as string,
      batchId: (record['batchId'] as string | null) ?? null,
      category: record['category'] as SuggestionCategory,
      content: record['content'] as string,
      status: record['status'] as SuggestionStatus,
      linkedMediaId: (record['linkedMediaId'] as string | null) ?? null,
      linkedAt: (record['linkedAt'] as Date | null) ?? null,
      outcome: (record['outcome'] as SuggestionOutcome | null) ?? null,
      measuredAt: (record['measuredAt'] as Date | null) ?? null,
      baselineJson: record['baselineJson'] as unknown,
      metricsJson: record['metricsJson'] as unknown,
      createdAt: record['createdAt'] as Date,
      updatedAt: record['updatedAt'] as Date,
    };
  }
}
