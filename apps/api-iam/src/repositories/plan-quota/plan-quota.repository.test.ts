import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaPlanQuotaRepository } from './plan-quota.repository.js';
import { NotFoundError } from '../../errors.js';
import type { ResourceType, QuotaPeriod } from '../../generated/prisma/client.js';

const makeQuotaRaw = (overrides: Partial<{
  id: string;
  planId: string;
  resourceType: ResourceType;
  limit: number;
  period: QuotaPeriod;
  createdAt: Date;
  updatedAt: Date;
}> = {}) => ({
  id: overrides.id ?? 'q1',
  planId: overrides.planId ?? 'plan-1',
  resourceType: overrides.resourceType ?? ('deepseek_tokens' as ResourceType),
  limit: overrides.limit ?? 5000,
  period: overrides.period ?? ('month' as QuotaPeriod),
  createdAt: overrides.createdAt ?? new Date('2026-01-01'),
  updatedAt: overrides.updatedAt ?? new Date('2026-01-01'),
});

function makePrisma() {
  return {
    planQuota: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}

describe('PrismaPlanQuotaRepository', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let repo: PrismaPlanQuotaRepository;

  beforeEach(() => {
    prisma = makePrisma();
    repo = new PrismaPlanQuotaRepository(prisma as never);
  });

  describe('findByPlanId', () => {
    it('returns empty array when no quotas exist for plan', async () => {
      prisma.planQuota.findMany.mockResolvedValue([]);

      const result = await repo.findByPlanId('empty-plan');

      expect(result).toEqual([]);
      expect(prisma.planQuota.findMany).toHaveBeenCalledWith({
        where: { planId: 'empty-plan' },
        orderBy: { resourceType: 'asc' },
      });
    });

    it('returns all quotas for a given plan', async () => {
      const raws = [
        makeQuotaRaw({ resourceType: 'deepseek_tokens' as ResourceType }),
        makeQuotaRaw({ id: 'q2', resourceType: 'fal_images' as ResourceType }),
      ];
      prisma.planQuota.findMany.mockResolvedValue(raws);

      const result = await repo.findByPlanId('plan-1');

      expect(result).toHaveLength(2);
      expect(result[0].resourceType).toBe('deepseek_tokens');
      expect(result[1].resourceType).toBe('fal_images');
      expect(result[0].limit).toBe(5000);
    });
  });

  describe('findAllByPlanIds', () => {
    it('returns quotas for multiple plans', async () => {
      const raws = [
        makeQuotaRaw({ planId: 'plan-1', resourceType: 'deepseek_tokens' as ResourceType }),
        makeQuotaRaw({ id: 'q2', planId: 'plan-2', resourceType: 'fal_images' as ResourceType }),
      ];
      prisma.planQuota.findMany.mockResolvedValue(raws);

      const result = await repo.findAllByPlanIds(['plan-1', 'plan-2']);

      expect(result).toHaveLength(2);
      expect(prisma.planQuota.findMany).toHaveBeenCalledWith({
        where: { planId: { in: ['plan-1', 'plan-2'] } },
        orderBy: { resourceType: 'asc' },
      });
    });

    it('returns empty array for empty planIds', async () => {
      prisma.planQuota.findMany.mockResolvedValue([]);

      const result = await repo.findAllByPlanIds([]);

      expect(result).toEqual([]);
    });
  });

  describe('upsert', () => {
    it('creates a new PlanQuota when none exists for plan+resourceType', async () => {
      prisma.planQuota.findUnique.mockResolvedValue(null);
      prisma.planQuota.create.mockResolvedValue(
        makeQuotaRaw({ resourceType: 'deepseek_tokens' as ResourceType, limit: 5000 }),
      );

      const result = await repo.upsert(
        'plan-1',
        'deepseek_tokens' as ResourceType,
        5000,
        'month' as QuotaPeriod,
      );

      expect(result.planId).toBe('plan-1');
      expect(result.resourceType).toBe('deepseek_tokens');
      expect(result.limit).toBe(5000);
      expect(result.period).toBe('month');
      expect(prisma.planQuota.create).toHaveBeenCalledTimes(1);
    });

    it('updates an existing PlanQuota when one exists for plan+resourceType', async () => {
      const existing = makeQuotaRaw({
        id: 'existing-id',
        resourceType: 'deepseek_tokens' as ResourceType,
        limit: 5000,
        period: 'month' as QuotaPeriod,
      });
      const updated = makeQuotaRaw({
        id: 'existing-id',
        resourceType: 'deepseek_tokens' as ResourceType,
        limit: 100000,
        period: 'day' as QuotaPeriod,
      });

      prisma.planQuota.findUnique.mockResolvedValue(existing);
      prisma.planQuota.update.mockResolvedValue(updated);

      const result = await repo.upsert(
        'plan-1',
        'deepseek_tokens' as ResourceType,
        100000,
        'day' as QuotaPeriod,
      );

      expect(result.id).toBe('existing-id');
      expect(result.limit).toBe(100000);
      expect(result.period).toBe('day');
      expect(prisma.planQuota.update).toHaveBeenCalledWith({
        where: { id: 'existing-id' },
        data: { limit: 100000, period: 'day' },
      });
      expect(prisma.planQuota.create).not.toHaveBeenCalled();
    });

    it('creates separate quotas for different resourceTypes on same plan', async () => {
      prisma.planQuota.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      prisma.planQuota.create
        .mockResolvedValueOnce(
          makeQuotaRaw({ id: 'q1', resourceType: 'deepseek_tokens' as ResourceType }),
        )
        .mockResolvedValueOnce(
          makeQuotaRaw({ id: 'q2', resourceType: 'fal_images' as ResourceType }),
        );

      const t = await repo.upsert('plan-1', 'deepseek_tokens' as ResourceType, 5000, 'month' as QuotaPeriod);
      const i = await repo.upsert('plan-1', 'fal_images' as ResourceType, 10, 'month' as QuotaPeriod);

      expect(t.id).toBe('q1');
      expect(i.id).toBe('q2');
      expect(prisma.planQuota.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('delete', () => {
    it('deletes an existing quota', async () => {
      prisma.planQuota.delete.mockResolvedValue(makeQuotaRaw());

      await expect(repo.delete('q1')).resolves.toBeUndefined();
      expect(prisma.planQuota.delete).toHaveBeenCalledWith({ where: { id: 'q1' } });
    });

    it('throws NotFoundError when deleting nonexistent quota', async () => {
      const error = Object.assign(new Error('Record not found'), { code: 'P2025' });
      prisma.planQuota.delete.mockRejectedValue(error);

      await expect(repo.delete('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });
});
