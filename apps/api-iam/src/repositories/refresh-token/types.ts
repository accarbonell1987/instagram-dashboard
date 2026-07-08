import type { Prisma } from '../../generated/prisma/client.js'
import type { RefreshToken } from '../../domain/index.js'

export interface CreateRefreshTokenInput {
  userId: string
  tokenHash: string
  familyId: string
  expiresAt: Date
  parentId?: string | undefined
}

export interface RefreshTokenRepository {
  create(data: CreateRefreshTokenInput, tx?: Prisma.TransactionClient): Promise<RefreshToken>
  findByHash(tokenHash: string): Promise<RefreshToken | null>
  findByHashForUpdate(tokenHash: string, tx: Prisma.TransactionClient): Promise<RefreshToken | null>
  markUsedByHash(tokenHash: string, tx?: Prisma.TransactionClient): Promise<void>
  invalidateFamily(familyId: string): Promise<void>
  findActiveByUserId(userId: string): Promise<RefreshToken[]>
  deleteExpired(): Promise<number>
  invalidateAllForUser(userId: string, tx?: Prisma.TransactionClient): Promise<void>
}
