/**
 * Unit tests for ChatMessage repository
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
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
} as unknown as PrismaClient;

// ─── Helpers ───────────────────────────────────────────────────────────────────

const TENANT_ID = 'b3e4c5d6-e7f8-4a9b-a0c1-d2e3f4a5b6c7';
const SESSION_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';

function makeRepo(): IChatMessageRepository {
  return new PrismaChatMessageRepository(mockPrisma);
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

  // T-01: deleteById
  describe('deleteById', () => {
    it('deletes the message by id and tenantId → resolves void', async () => {
      const repo = makeRepo();
      mockPrisma.chatMessage.delete.mockResolvedValueOnce(makePrismaMessage());

      await expect(
        repo.deleteById(TENANT_ID, 'msg-1'),
      ).resolves.toBeUndefined();

      expect(mockPrisma.chatMessage.delete).toHaveBeenCalledWith({
        where: { id: 'msg-1', tenantId: TENANT_ID },
      });
    });

    it('throws if message not found (Prisma rejects with P2025)', async () => {
      const repo = makeRepo();
      const prismaError = new Error('Record to delete does not exist.');
      (prismaError as any).code = 'P2025';
      mockPrisma.chatMessage.delete.mockRejectedValueOnce(prismaError);

      await expect(
        repo.deleteById(TENANT_ID, 'nonexistent-id'),
      ).rejects.toThrow('Record to delete does not exist.');
    });

    it('throws if tenantId mismatch (message belongs to different tenant)', async () => {
      const repo = makeRepo();
      const prismaError = new Error('Record to delete does not exist.');
      (prismaError as any).code = 'P2025';
      mockPrisma.chatMessage.delete.mockRejectedValueOnce(prismaError);

      await expect(
        repo.deleteById('other-tenant-id', 'msg-1'),
      ).rejects.toThrow('Record to delete does not exist.');
    });
  });

  // T-01: deleteBySessionId
  describe('deleteBySessionId', () => {
    it('deletes all messages in session for tenant → returns count', async () => {
      const repo = makeRepo();
      mockPrisma.chatMessage.deleteMany.mockResolvedValueOnce({ count: 5 });

      const count = await repo.deleteBySessionId(TENANT_ID, SESSION_ID);

      expect(count).toBe(5);
      expect(mockPrisma.chatMessage.deleteMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, sessionId: SESSION_ID },
      });
    });

    it('returns 0 when session has no messages', async () => {
      const repo = makeRepo();
      mockPrisma.chatMessage.deleteMany.mockResolvedValueOnce({ count: 0 });

      const count = await repo.deleteBySessionId(TENANT_ID, 'empty-session');

      expect(count).toBe(0);
    });

    it('does not delete messages from other tenants', async () => {
      const repo = makeRepo();
      mockPrisma.chatMessage.deleteMany.mockResolvedValueOnce({ count: 0 });

      const count = await repo.deleteBySessionId('other-tenant-id', SESSION_ID);

      expect(count).toBe(0);
      expect(mockPrisma.chatMessage.deleteMany).toHaveBeenCalledWith({
        where: { tenantId: 'other-tenant-id', sessionId: SESSION_ID },
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

      const messages = await repo.findBySession(TENANT_ID, SESSION_ID);

      // Should return exactly 20 messages
      expect(messages).toHaveLength(20);

      // After .reverse() in code: oldest first → msg-6, msg-7, ..., msg-25
      expect(messages[0]?.id).toBe('msg-6');
      expect(messages[19]?.id).toBe('msg-25');

      // Prisma query should be: orderBy desc, take 20
      expect(mockPrisma.chatMessage.findMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, sessionId: SESSION_ID },
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

      const messages = await repo.findBySession(TENANT_ID, SESSION_ID);

      // After .reverse(): [msg-1, msg-2, msg-3]
      expect(messages).toHaveLength(3);
      expect(messages[0]?.id).toBe('msg-1');
      expect(messages[2]?.id).toBe('msg-3');
    });

    it('returns empty array when session has no messages', async () => {
      const repo = makeRepo();
      mockPrisma.chatMessage.findMany.mockResolvedValueOnce([]);

      const messages = await repo.findBySession(TENANT_ID, 'empty-session');

      expect(messages).toEqual([]);
    });
  });
});
