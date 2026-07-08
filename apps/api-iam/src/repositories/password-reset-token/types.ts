import type { PasswordResetToken } from '../../domain/index.js'

export interface PasswordResetTokenRepository {
  create(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<PasswordResetToken>
  findByHash(tokenHash: string): Promise<PasswordResetToken | null>
  markUsed(id: string): Promise<void>
  deleteExpired(): Promise<number>
}
