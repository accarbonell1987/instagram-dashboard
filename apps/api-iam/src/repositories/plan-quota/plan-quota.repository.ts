import crypto from 'node:crypto';
import type { PrismaClient, ResourceType, QuotaPeriod } from '../../generated/prisma/client.js';
import { NotFoundError, ConflictError } from '../../errors.js';
import type { PlanQuotaRepository, PlanQuotaData, UpsertPlanQuotaInput } from './types.js';

function mapPlanQuota(raw: {
  id: string;
  planId: string;
  resourceType: ResourceType;
  limit: number;
  period: QuotaPeriod;
  createdAt: Date;
  updatedAt: Date;
}): PlanQuotaData {
  return {
    id: raw.id,
    planId: raw.planId,
    resourceType: raw.resourceType,
    limit: raw.limit,
    period: raw.period,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export class PrismaPlanQuotaRepository implements PlanQuotaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByPlanId(planId: string): Promise<PlanQuotaData[]> {
    const rows = await this.prisma.planQuota.findMany({
      where: { planId },
      orderBy: { resourceType: 'asc' },
    });
    return rows.map(mapPlanQuota);
  }

  async findAllByPlanIds(planIds: string[]): Promise<PlanQuotaData[]> {
    const rows = await this.prisma.planQuota.findMany({
      where: { planId: { in: planIds } },
      orderBy: { resourceType: 'asc' },
    });
    return rows.map(mapPlanQuota);
  }

  async upsert(
    planId: string,
    resourceType: ResourceType,
    limit: number,
    period: QuotaPeriod,
  ): Promise<PlanQuotaData> {
    const existing = await this.prisma.planQuota.findUnique({
      where: { planId_resourceType: { planId, resourceType } },
    });

    if (existing) {
      const raw = await this.prisma.planQuota.update({
        where: { id: existing.id },
        data: { limit, period },
      });
      return mapPlanQuota(raw);
    }

    const raw = await this.prisma.planQuota.create({
      data: {
        id: crypto.randomUUID(),
        planId,
        resourceType,
        limit,
        period,
      },
    });
    return mapPlanQuota(raw);
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.planQuota.delete({ where: { id } });
    } catch (error: unknown) {
      if (
        error !== null &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundError('plan_quotas.not_found');
      }
      throw error;
    }
  }
}
