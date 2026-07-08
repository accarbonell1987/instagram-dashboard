import type { PrismaClient } from '@prisma/client';
import { SuggestionCategory, SuggestionStatus, SuggestionOutcome } from '@prisma/client';

export type { SuggestionCategory, SuggestionStatus, SuggestionOutcome };

export interface ContentSuggestion {
  id: string;
  tenantId: string;
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
  batchId?: string | undefined;
  category: SuggestionCategory;
  content: string;
}

export interface SuggestionBatch {
  id: string;
  tenantId: string;
  userMessage: string;
  createdAt: Date;
  suggestions: ContentSuggestion[];
}

export interface CreateBatch {
  tenantId: string;
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
  findByTenant(tenantId: string, status?: SuggestionStatus): Promise<ContentSuggestion[]>;
  findById(tenantId: string, id: string): Promise<ContentSuggestion | null>;
  update(tenantId: string, id: string, data: UpdateSuggestion): Promise<ContentSuggestion>;
  findEligibleForMeasurement(): Promise<ContentSuggestion[]>;
  // Batches
  createBatch(data: CreateBatch): Promise<SuggestionBatch>;
  findBatchesByTenant(tenantId: string, page: number, limit: number): Promise<{ batches: SuggestionBatch[]; total: number }>;
}

export class PrismaSuggestionRepository implements ISuggestionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateSuggestion): Promise<ContentSuggestion> {
    const record = await this.prisma.contentSuggestion.create({
      data: {
        tenantId: data.tenantId,
        category: data.category,
        content: data.content,
        ...(data.batchId !== undefined ? { batchId: data.batchId } : {}),
      },
    });
    return this.toDomain(record);
  }

  async findByTenant(tenantId: string, status?: SuggestionStatus): Promise<ContentSuggestion[]> {
    const whereStatus =
      status !== undefined
        ? { status }
        : { status: { not: SuggestionStatus.dismissed } };

    const records = await this.prisma.contentSuggestion.findMany({
      where: { tenantId, ...whereStatus },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findById(tenantId: string, id: string): Promise<ContentSuggestion | null> {
    const record = await this.prisma.contentSuggestion.findFirst({
      where: { tenantId, id },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async update(tenantId: string, id: string, data: UpdateSuggestion): Promise<ContentSuggestion> {
    const record = await this.prisma.contentSuggestion.update({
      where: { id },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.linkedMediaId !== undefined && { linkedMediaId: data.linkedMediaId }),
        ...(data.linkedAt !== undefined && { linkedAt: data.linkedAt }),
        ...(data.outcome !== undefined && { outcome: data.outcome }),
        ...(data.measuredAt !== undefined && { measuredAt: data.measuredAt }),
        ...(data.baselineJson !== undefined && { baselineJson: data.baselineJson as object }),
        ...(data.metricsJson !== undefined && { metricsJson: data.metricsJson as object }),
        tenantId, // enforce tenant isolation
      },
    });
    return this.toDomain(record);
  }

  async createBatch(data: CreateBatch): Promise<SuggestionBatch> {
    const record = await this.prisma.suggestionBatch.create({
      data: {
        tenantId: data.tenantId,
        userMessage: data.userMessage,
      },
    });
    return {
      id: record.id,
      tenantId: record.tenantId,
      userMessage: record.userMessage,
      createdAt: record.createdAt,
      suggestions: [],
    };
  }

  async findBatchesByTenant(
    tenantId: string,
    page: number,
    limit: number,
  ): Promise<{ batches: SuggestionBatch[]; total: number }> {
    const [total, records] = await Promise.all([
      this.prisma.suggestionBatch.count({ where: { tenantId } }),
      this.prisma.suggestionBatch.findMany({
        where: { tenantId },
        include: { suggestions: { orderBy: { createdAt: 'asc' } } },
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
