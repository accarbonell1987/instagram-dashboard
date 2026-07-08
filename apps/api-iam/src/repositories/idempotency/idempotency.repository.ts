import type { PrismaClient, Prisma } from '../../generated/prisma/client.js'
import type { IdempotencyRecord } from '../../domain/index.js'
import type { CreateIdempotencyInput, IdempotencyRepository } from './types.js'

function mapRecord(raw: {
  key: string
  requestHash: string
  responseStatus: number
  responseBody: unknown
  responseHeaders: unknown | null
  expiresAt: Date
  createdAt: Date
}): IdempotencyRecord {
  return {
    key: raw.key,
    requestHash: raw.requestHash,
    responseStatus: raw.responseStatus,
    responseBody: raw.responseBody as Record<string, unknown>,
    responseHeaders: (raw.responseHeaders as Record<string, unknown>) ?? undefined,
    expiresAt: raw.expiresAt,
    createdAt: raw.createdAt,
  }
}

export class PrismaIdempotencyRepository implements IdempotencyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByKey(key: string, tx: Prisma.TransactionClient): Promise<IdempotencyRecord | null> {
    const rows = await tx.$queryRaw<Array<{
      key: string
      request_hash: string
      response_status: number
      response_body: unknown
      response_headers: unknown | null
      expires_at: Date
      created_at: Date
    }>>`
      SELECT key, request_hash, response_status, response_body, response_headers, expires_at, created_at
      FROM idempotency_records
      WHERE key = ${key}::uuid
      FOR UPDATE
    `
    const [row] = rows
    if (!row) return null
    return {
      key: row.key,
      requestHash: row.request_hash,
      responseStatus: row.response_status,
      responseBody: row.response_body as Record<string, unknown>,
      responseHeaders: (row.response_headers as Record<string, unknown>) ?? undefined,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }
  }

  async create(data: CreateIdempotencyInput): Promise<IdempotencyRecord> {
    const raw = await this.prisma.idempotencyRecord.create({
      data: {
        key: data.key,
        requestHash: data.requestHash,
        responseBody: data.responseBody as Prisma.InputJsonValue,
        responseStatus: data.responseStatus,
        expiresAt: data.expiresAt,
        responseHeaders: (data.responseHeaders ?? null) as Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue,
      },
    })
    return mapRecord(raw)
  }

  async deleteExpired(): Promise<number> {
    const result = await this.prisma.idempotencyRecord.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })
    return result.count
  }
}
