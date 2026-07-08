import type { PrismaClient } from '../../generated/prisma/client.js'
import type { PasswordResetToken } from '../../domain/index.js'
import type { PasswordResetTokenRepository } from './types.js'

function mapToken(raw: {
  id: string
  userId: string
  tokenHash: string
  used: boolean
  expiresAt: Date
  createdAt: Date
}): PasswordResetToken {
  return {
    id: raw.id,
    userId: raw.userId,
    tokenHash: raw.tokenHash,
    used: raw.used,
    expiresAt: raw.expiresAt,
    createdAt: raw.createdAt,
  }
}

export class PrismaPasswordResetTokenRepository implements PasswordResetTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<PasswordResetToken> {
    const raw = await this.prisma.passwordResetToken.create({ data })
    return mapToken(raw)
  }

  async findByHash(tokenHash: string): Promise<PasswordResetToken | null> {
    const raw = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } })
    return raw ? mapToken(raw) : null
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.passwordResetToken.update({ where: { id }, data: { used: true } })
  }

  async deleteExpired(): Promise<number> {
    const result = await this.prisma.passwordResetToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })
    return result.count
  }
}
