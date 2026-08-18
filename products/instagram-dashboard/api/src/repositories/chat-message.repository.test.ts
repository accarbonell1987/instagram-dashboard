/**
 * Unit tests for ChatMessage repository
 */
import type { PrismaClient } from '@prisma/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PrismaChatMessageRepository } from './chat-message.repository.js';
import type { IChatMessageRepository } from './chat-message.repository.js';

// ─── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  chatMessage: {
    create: vi.fn(),
    findMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const TENANT_ID = 'b3e4c5d6-e7f8-4a9b-a0c1-d2e3f4a5b6c7';
const SESSION_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const USER_ID = 'c4d5e6f7-a8b9-4c0d-9e1f-a2b3c4d5e6f7';
const OWNER = { tenantId: TENANT_ID, userId: USER_ID };

function makeRepo(): IChatMessageRepository {
  return new PrismaChatMessageRepository(mockPrisma as unknown as PrismaClient);
}

function makePrismaMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg-1',
    tenantId: TENANT_ID,
    sessionId: SESSION_ID,
    role: 'user',
    content: 'Hello',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('PrismaChatMessageRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('deleteById', () => {
    it("removes the caller's own message", async () => {
      const repo = makeRepo();
      mockPrisma.chatMessage.deleteMany.mockResolvedValueOnce({ count: 1 });

      await expect(repo.deleteById(OWNER, 'msg-1')).resolves.toBeUndefined();

      expect(mockPrisma.chatMessage.deleteMany).toHaveBeenCalledWith({
        where: { id: 'msg-1', tenantId: TENANT_ID, userId: USER_ID },
      });
    });

    /**
     * Scoped by owner, so a message belonging to somebody else simply matches
     * nothing. Deleting what is not yours removes nothing and reports no error
     * — the caller cannot tell whether it existed, which is the point.
     */
    it("leaves another member's message alone", async () => {
      const repo = makeRepo();
      mockPrisma.chatMessage.deleteMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        repo.deleteById({ tenantId: TENANT_ID, userId: 'someone-else' }, 'msg-1'),
      ).resolves.toBeUndefined();

      expect(mockPrisma.chatMessage.deleteMany).toHaveBeenCalledWith({
        where: { id: 'msg-1', tenantId: TENANT_ID, userId: 'someone-else' },
      });
    });
  });

  // T-01: deleteBySessionId
  describe('deleteBySessionId', () => {
    it('deletes all messages in session for tenant → returns count', async () => {
      const repo = makeRepo();
      mockPrisma.chatMessage.deleteMany.mockResolvedValueOnce({ count: 5 });

      const count = await repo.deleteBySessionId(OWNER, SESSION_ID);

      expect(count).toBe(5);
      expect(mockPrisma.chatMessage.deleteMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, userId: USER_ID, sessionId: SESSION_ID },
      });
    });

    it('returns 0 when session has no messages', async () => {
      const repo = makeRepo();
      mockPrisma.chatMessage.deleteMany.mockResolvedValueOnce({ count: 0 });

      const count = await repo.deleteBySessionId(OWNER, 'empty-session');

      expect(count).toBe(0);
    });

    it('does not delete messages from other tenants', async () => {
      const repo = makeRepo();
      mockPrisma.chatMessage.deleteMany.mockResolvedValueOnce({ count: 0 });

      const count = await repo.deleteBySessionId({ tenantId: 'other-tenant-id', userId: USER_ID }, SESSION_ID);

      expect(count).toBe(0);
      expect(mockPrisma.chatMessage.deleteMany).toHaveBeenCalledWith({
        where: { tenantId: 'other-tenant-id', userId: USER_ID, sessionId: SESSION_ID },
      });
    });
  });

  // T-02: findBySession limit to 20
  describe('findBySession', () => {
    it('returns messages ordered asc, limited to last 20', async () => {
      const repo = makeRepo();

      // Create 25 messages oldest-first (asc)
      const allMessages = Array.from({ length: 25 }, (_, i) =>
        makePrismaMessage({
          id: `msg-${String(i + 1)}`,
          createdAt: new Date(`2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`),
        }),
      );

      // Prisma returns DESC order (newest first), take 20 → newest 20 in desc order
      const prismaResult = [...allMessages].reverse().slice(0, 20);
      // prismaResult = [msg-25, msg-24, ..., msg-6] (newest first)
      mockPrisma.chatMessage.findMany.mockResolvedValueOnce(prismaResult);

      const messages = await repo.findBySession(OWNER, SESSION_ID);

      // Should return exactly 20 messages
      expect(messages).toHaveLength(20);

      // After .reverse() in code: oldest first → msg-6, msg-7, ..., msg-25
      expect(messages[0]?.id).toBe('msg-6');
      expect(messages[19]?.id).toBe('msg-25');

      // Prisma query should be: orderBy desc, take 20
      expect(mockPrisma.chatMessage.findMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, userId: USER_ID, sessionId: SESSION_ID },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    });

    it('returns fewer than 20 when session has less messages', async () => {
      const repo = makeRepo();

      // Prisma returns newest-first (desc), so [msg-3, msg-2, msg-1]
      const prismaResults = [
        makePrismaMessage({ id: 'msg-3', createdAt: new Date('2026-01-03T00:00:00.000Z') }),
        makePrismaMessage({ id: 'msg-2', createdAt: new Date('2026-01-02T00:00:00.000Z') }),
        makePrismaMessage({ id: 'msg-1', createdAt: new Date('2026-01-01T00:00:00.000Z') }),
      ];

      mockPrisma.chatMessage.findMany.mockResolvedValueOnce(prismaResults);

      const messages = await repo.findBySession(OWNER, SESSION_ID);

      // After .reverse(): [msg-1, msg-2, msg-3]
      expect(messages).toHaveLength(3);
      expect(messages[0]?.id).toBe('msg-1');
      expect(messages[2]?.id).toBe('msg-3');
    });

    it('returns empty array when session has no messages', async () => {
      const repo = makeRepo();
      mockPrisma.chatMessage.findMany.mockResolvedValueOnce([]);

      const messages = await repo.findBySession(OWNER, 'empty-session');

      expect(messages).toEqual([]);
    });
  });
});

/**
 * The reason this change exists.
 *
 * Chat was scoped by tenant alone, and a tenant has many members — so every
 * member could read every other member's conversation with the agent by asking
 * for the same session. These pin the scope to the person, not the company.
 */
describe('PrismaChatMessageRepository — per-member isolation', () => {
  it('reads only the calling member\'s messages', async () => {
    const repo = makeRepo();
    mockPrisma.chatMessage.findMany.mockResolvedValueOnce([]);

    await repo.findBySession({ tenantId: TENANT_ID, userId: 'member-a' }, SESSION_ID);

    expect(mockPrisma.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_ID, userId: 'member-a', sessionId: SESSION_ID },
      }),
    );
  });

  // Same tenant, same session id, different person: still not their history.
  it('does not widen to the tenant when a colleague asks', async () => {
    const repo = makeRepo();
    mockPrisma.chatMessage.findMany.mockResolvedValueOnce([]);

    await repo.findBySession({ tenantId: TENANT_ID, userId: 'member-b' }, SESSION_ID);

    const where = mockPrisma.chatMessage.findMany.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where['userId']).toBe('member-b');
    expect(Object.keys(where)).toContain('userId');
  });
});
