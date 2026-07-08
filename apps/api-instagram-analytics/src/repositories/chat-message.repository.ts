import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { MessageRole } from '@prisma/client';

export type { MessageRole };

export interface ChatMessage {
  id: string;
  tenantId: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
}

export interface CreateChatMessage {
  tenantId: string;
  sessionId: string;
  role: MessageRole;
  content: string;
}

export interface IChatMessageRepository {
  save(msg: CreateChatMessage): Promise<ChatMessage>;
  findBySession(tenantId: string, sessionId: string): Promise<ChatMessage[]>;
  deleteById(tenantId: string, id: string): Promise<void>;
  deleteBySessionId(tenantId: string, sessionId: string): Promise<number>;
}

export class PrismaChatMessageRepository implements IChatMessageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(msg: CreateChatMessage): Promise<ChatMessage> {
    const record = await this.prisma.chatMessage.create({
      data: {
        tenantId: msg.tenantId,
        sessionId: msg.sessionId,
        role: msg.role,
        content: msg.content,
      },
    });
    return {
      id: record.id,
      tenantId: record.tenantId,
      sessionId: record.sessionId,
      role: record.role,
      content: record.content,
      createdAt: record.createdAt,
    };
  }

  async findBySession(tenantId: string, sessionId: string): Promise<ChatMessage[]> {
    const records = await this.prisma.chatMessage.findMany({
      where: { tenantId, sessionId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    // Reverse to maintain asc order for display (oldest first)
    const ordered = records.reverse();
    return ordered.map((record) => ({
      id: record.id,
      tenantId: record.tenantId,
      sessionId: record.sessionId,
      role: record.role,
      content: record.content,
      createdAt: record.createdAt,
    }));
  }

  async deleteById(tenantId: string, id: string): Promise<void> {
    try {
      await this.prisma.chatMessage.delete({
        where: { id, tenantId },
      });
    } catch (err) {
      // P2025 = record not found — idempotent, silently succeed
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return;
      }
      throw err;
    }
  }

  async deleteBySessionId(tenantId: string, sessionId: string): Promise<number> {
    const result = await this.prisma.chatMessage.deleteMany({
      where: { tenantId, sessionId },
    });
    return result.count;
  }
}
