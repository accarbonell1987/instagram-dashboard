import type { ResourceType, QuotaPeriod } from '../../generated/prisma/client.js';

export interface PlanQuotaData {
  id: string;
  planId: string;
  resourceType: ResourceType;
  limit: number;
  period: QuotaPeriod;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePlanQuotaInput {
  planId: string;
  resourceType: ResourceType;
  limit: number;
  period: QuotaPeriod;
}

export interface UpsertPlanQuotaInput {
  resourceType: ResourceType;
  limit: number;
  period: QuotaPeriod;
}

export interface PlanQuotaRepository {
  findByPlanId(planId: string): Promise<PlanQuotaData[]>;
  findAllByPlanIds(planIds: string[]): Promise<PlanQuotaData[]>;
  upsert(planId: string, resourceType: ResourceType, limit: number, period: QuotaPeriod): Promise<PlanQuotaData>;
  delete(id: string): Promise<void>;
}
