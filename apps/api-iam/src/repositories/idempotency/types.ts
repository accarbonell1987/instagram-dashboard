import type { Prisma } from '../../generated/prisma/client.js'
import type { IdempotencyRecord } from '../../domain/index.js'

export interface CreateIdempotencyInput {
  key: string
  requestHash: string
  responseBody: Record<string, unknown>
  responseStatus: number
  expiresAt: Date
  responseHeaders?: Record<string, unknown> | undefined
}

export interface IdempotencyRepository {
  findByKey(key: string, tx: Prisma.TransactionClient): Promise<IdempotencyRecord | null>
  create(data: CreateIdempotencyInput): Promise<IdempotencyRecord>
  deleteExpired(): Promise<number>
}
