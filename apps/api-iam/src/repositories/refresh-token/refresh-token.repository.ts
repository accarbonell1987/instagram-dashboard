import type { PrismaClient, Prisma } from '../../generated/prisma/client.js'
import type { RefreshToken } from '../../domain/index.js'
import type { CreateRefreshTokenInput, RefreshTokenRepository } from './types.js'

function mapToken(raw: {
  id: string
  userId: string
  tokenHash: string
  familyId: string
  parentId: string | null
  usedAt: Date | null
  expiresAt: Date
  createdAt: Date
}): RefreshToken {
  return {
    id: raw.id,
    userId: raw.userId,
    tokenHash: raw.tokenHash,
    familyId: raw.familyId,
    parentId: raw.parentId ?? undefined,
    usedAt: raw.usedAt ?? undefined,
    expiresAt: raw.expiresAt,
    createdAt: raw.createdAt,
  }
}

export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateRefreshTokenInput, tx?: Prisma.TransactionClient): Promise<RefreshToken> {
    const client = tx ?? this.prisma;
    const raw = await client.refreshToken.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        familyId: data.familyId,
        expiresAt: data.expiresAt,
        parentId: data.parentId ?? null,
      },
    })
    return mapToken(raw)
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const raw = await this.prisma.refreshToken.findUnique({ where: { tokenHash } })
    return raw ? mapToken(raw) : null
  }

  async findByHashForUpdate(
    tokenHash: string,
    tx: Prisma.TransactionClient
  ): Promise<RefreshToken | null> {
    const rows = await tx.$queryRaw<Array<{
      id: string
      user_id: string
      token_hash: string
      family_id: string
      parent_id: string | null
      used_at: Date | null
      expires_at: Date
      created_at: Date
    }>>`
      SELECT id, user_id, token_hash, family_id, parent_id, used_at, expires_at, created_at
      FROM refresh_tokens
      WHERE token_hash = ${tokenHash}
      FOR UPDATE
    `
    const [row] = rows
    if (!row) return null
    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      familyId: row.family_id,
      parentId: row.parent_id ?? undefined,
      usedAt: row.used_at ?? undefined,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }
  }

  async markUsedByHash(tokenHash: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.refreshToken.update({
      where: { tokenHash },
      data: { usedAt: new Date() },
    })
  }

  async invalidateFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, usedAt: null },
      data: { usedAt: new Date() },
    })
  }

  async findActiveByUserId(userId: string): Promise<RefreshToken[]> {
    const rows = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    })
    return rows.map(mapToken)
  }

  async deleteExpired(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })
    return result.count
  }

  async invalidateAllForUser(userId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.refreshToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    })
  }
}
