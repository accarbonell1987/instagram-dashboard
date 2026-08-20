import { describe, it, expect, vi } from 'vitest';

import { PrismaSuggestionRepository } from './suggestion.repository.js';

const OWNER = { tenantId: 'tenant-1', userId: 'user-a' };

function makePrisma(updatedCount: number) {
  return {
    contentSuggestion: {
      updateMany: vi.fn().mockResolvedValue({ count: updatedCount }),
      findFirstOrThrow: vi.fn().mockResolvedValue({
        id: 'sug-1',
        tenantId: OWNER.tenantId,
        userId: OWNER.userId,
        batchId: null,
        category: 'content_idea',
        content: 'idea',
        status: 'used',
        linkedMediaId: null,
        linkedAt: null,
        outcome: null,
        measuredAt: null,
        baselineJson: null,
        metricsJson: null,
        createdAt: new Date(),
      }),
    },
  };
}

/**
 * The owner used to be spread into `data` under a comment saying it enforced
 * isolation. It matched on id alone, so any member could mark another member's
 * suggestion used or dismissed — and the write then set the caller's tenantId
 * and userId on the row, moving it to whoever touched it last.
 */
describe('PrismaSuggestionRepository.update — owner isolation', () => {
  it('filters by owner, not only by id', async () => {
    const prisma = makePrisma(1);
    const repo = new PrismaSuggestionRepository(prisma as never);

    await repo.update(OWNER, 'sug-1', { status: 'used' });

    expect(prisma.contentSuggestion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', userId: 'user-a', id: 'sug-1' },
      }),
    );
  });

  it('never writes ownership into the row', async () => {
    const prisma = makePrisma(1);
    const repo = new PrismaSuggestionRepository(prisma as never);

    await repo.update(OWNER, 'sug-1', { status: 'used' });

    const { data } = prisma.contentSuggestion.updateMany.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(data).not.toHaveProperty('tenantId');
    expect(data).not.toHaveProperty('userId');
  });

  /**
   * Not found rather than forbidden: telling a caller that an id exists under
   * another owner is an existence oracle.
   */
  it('refuses a suggestion belonging to someone else', async () => {
    const prisma = makePrisma(0);
    const repo = new PrismaSuggestionRepository(prisma as never);

    await expect(repo.update(OWNER, 'someone-elses', { status: 'used' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('does not read a row back when nothing was updated', async () => {
    const prisma = makePrisma(0);
    const repo = new PrismaSuggestionRepository(prisma as never);

    await expect(repo.update(OWNER, 'x', { status: 'used' })).rejects.toThrow();

    expect(prisma.contentSuggestion.findFirstOrThrow).not.toHaveBeenCalled();
  });
});

/**
 * The grouped panel is the one screen that reads suggestions through their
 * batch. Filtering the batch alone trusts that every suggestion under it shares
 * its owner — which is true right up until something makes it false.
 */
describe('PrismaSuggestionRepository.findBatchesByOwner', () => {
  it('carries the owner into the nested read as well', async () => {
    const prisma = {
      suggestionBatch: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const repo = new PrismaSuggestionRepository(prisma as never);

    await repo.findBatchesByOwner(OWNER, 1, 10);

    const args = prisma.suggestionBatch.findMany.mock.calls[0]?.[0] as {
      where: unknown;
      include: { suggestions: { where: unknown } };
    };
    expect(args.where).toEqual(OWNER);
    expect(args.include.suggestions.where).toEqual(OWNER);
  });
});

