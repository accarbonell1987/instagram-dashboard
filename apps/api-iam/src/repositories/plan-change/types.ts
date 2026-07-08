import type { Prisma } from '../../generated/prisma/client.js';

export interface CreatePlanChangeInput {
  tenantId: string;
  requestedBy: string;
  fromPlanId: string;
  toPlanId: string;
}

export interface PlanChangeRepositoryItem {
  id: string;
  tenantId: string;
  requestedBy: string;
  fromPlanId: string;
  toPlanId: string;
  status: 'pending' | 'reviewed';
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanChangeRepository {
  findPendingByTenant(tenantId: string): Promise<PlanChangeRepositoryItem | null>;
  create(data: CreatePlanChangeInput, tx: Prisma.TransactionClient): Promise<PlanChangeRepositoryItem>;
}
