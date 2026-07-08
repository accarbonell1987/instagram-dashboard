import type { PrismaClient, Prisma } from '../../generated/prisma/client.js';
import type { CreatePlanChangeInput, PlanChangeRepository, PlanChangeRepositoryItem } from './types.js';

function mapPlanChangeRequest(raw: {
  id: string;
  tenantId: string;
  requestedBy: string;
  fromPlanId: string;
  toPlanId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): PlanChangeRepositoryItem {
  return {
    id: raw.id,
    tenantId: raw.tenantId,
    requestedBy: raw.requestedBy,
    fromPlanId: raw.fromPlanId,
    toPlanId: raw.toPlanId,
    status: raw.status as PlanChangeRepositoryItem['status'],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export class PrismaPlanChangeRepository implements PlanChangeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findPendingByTenant(tenantId: string): Promise<PlanChangeRepositoryItem | null> {
    const raw = await this.prisma.planChangeRequest.findFirst({
      where: { tenantId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
    return raw ? mapPlanChangeRequest(raw) : null;
  }

  async create(data: CreatePlanChangeInput, tx: Prisma.TransactionClient): Promise<PlanChangeRepositoryItem> {
    const raw = await tx.planChangeRequest.create({
      data: {
        tenantId: data.tenantId,
        requestedBy: data.requestedBy,
        fromPlanId: data.fromPlanId,
        toPlanId: data.toPlanId,
      },
    });
    return mapPlanChangeRequest(raw);
  }
}
