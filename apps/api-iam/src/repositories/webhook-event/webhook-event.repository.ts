import type { PrismaClient } from '../../generated/prisma/client.js'
import type { WebhookEventRepository } from './types.js'

export class PrismaWebhookEventRepository implements WebhookEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async insertEvent(data: {
    source: string
    processId: string
    status: string
    rawBody: unknown
  }): Promise<boolean> {
    const affected = await this.prisma.$executeRaw`
      INSERT INTO webhook_events (id, source, process_id, status, raw_body, processed_at, created_at)
      VALUES (
        gen_random_uuid(),
        ${data.source}::"webhook_source",
        ${data.processId},
        ${data.status},
        ${JSON.stringify(data.rawBody)}::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (process_id, status) DO NOTHING
    `
    return affected > 0
  }
}
