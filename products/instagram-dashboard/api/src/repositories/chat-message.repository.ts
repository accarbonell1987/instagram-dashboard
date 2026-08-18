import type { PrismaClient, MessageRole } from '@prisma/client';

import type { Owner } from '../domain/owner.js';

export type { MessageRole };

export interface ChatMessage {
  id: string;
  tenantId: string;
  userId: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
}

export interface CreateChatMessage {
  tenantId: string;
  userId: string;
  sessionId: string;
  role: MessageRole;
  content: string;
}

export interface IChatMessageRepository {
  save(msg: CreateChatMessage): Promise<ChatMessage>;
  findBySession(owner: Owner, sessionId: string): Promise<ChatMessage[]>;
  deleteById(owner: Owner, id: string): Promise<void>;
  deleteBySessionId(owner: Owner, sessionId: string): Promise<number>;
}

export class PrismaChatMessageRepository implements IChatMessageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(msg: CreateChatMessage): Promise<ChatMessage> {
    const record = await this.prisma.chatMessage.create({
      data: {
        tenantId: msg.tenantId,
        userId: msg.userId,
        sessionId: msg.sessionId,
        role: msg.role,
        content: msg.content,
      },
    });
    return {
      id: record.id,
      tenantId: record.tenantId,
      userId: record.userId,
      sessionId: record.sessionId,
      role: record.role,
      content: record.content,
      createdAt: record.createdAt,
    };
  }

  async findBySession(owner: Owner, sessionId: string): Promise<ChatMessage[]> {
    const records = await this.prisma.chatMessage.findMany({
      where: { ...owner, sessionId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    // Reverse to maintain asc order for display (oldest first)
    const ordered = records.reverse();
    return ordered.map((record) => ({
      id: record.id,
      tenantId: record.tenantId,
      userId: record.userId,
      sessionId: record.sessionId,
      role: record.role,
      content: record.content,
      createdAt: record.createdAt,
    }));
  }

  /**
   * deleteMany, not delete: `delete` takes a unique where, so scoping it by
   * owner would mean reading the row first and trusting it in between. This
   * also makes the operation naturally idempotent — deleting something that is
   * not there, or belongs to somebody else, removes nothing and says so by
   * removing nothing.
   */
  async deleteById(owner: Owner, id: string): Promise<void> {
    await this.prisma.chatMessage.deleteMany({ where: { id, ...owner } });
  }

  async deleteBySessionId(owner: Owner, sessionId: string): Promise<number> {
    const result = await this.prisma.chatMessage.deleteMany({
      where: { ...owner, sessionId },
    });
    return result.count;
  }
}
