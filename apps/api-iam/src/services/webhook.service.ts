import { createHmac, timingSafeEqual } from 'crypto'
import type { PrismaClient } from '../generated/prisma/client.js'
import type { WebhookEventRepository, PaymentRepository, OnboardingDraftRepository } from '../repositories/index.js'
import type { Config } from '../config.js'
import { UnauthorizedError } from '../errors.js'

export type WebhookServiceDeps = {
  webhookEventRepo: WebhookEventRepository
  paymentRepo: PaymentRepository
  draftRepo: OnboardingDraftRepository
  prisma: PrismaClient
  config: Config
}

export type BancardWebhookPayload = {
  process_id: string
  status: string
  response_code: string
  response_description: string
  amount: number
  authorization_number: string
  operation_date: string
}

function verifyBancardSignature(secret: string, rawBody: string, signature: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  // Use constant-time comparison to prevent timing attacks
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
  } catch {
    // Buffers of different length throw — signature is definitely invalid
    return false
  }
}

export function createWebhookService(deps: WebhookServiceDeps) {
  const { webhookEventRepo, paymentRepo, draftRepo, prisma, config } = deps

  async function processBancardWebhook(params: {
    rawBody: string
    signature: string
    payload: BancardWebhookPayload
  }): Promise<{ received: boolean }> {
    const { rawBody, signature, payload } = params

    // Signature verification happens BEFORE the transaction — no point opening a tx for a bad signature
    if (!verifyBancardSignature(config.BANCARD_WEBHOOK_SECRET, rawBody, signature)) {
      throw new UnauthorizedError('webhook.invalid_signature')
    }

    await prisma.$transaction(async (tx) => {
      // ── Step 1: Idempotent insert via UNIQUE(process_id, status) ───────
      // The repository's insertEvent uses ON CONFLICT DO NOTHING and returns true if new
      // We need to use raw SQL here since the repo doesn't accept a tx parameter
      const isNew = await tx.$executeRaw`
        INSERT INTO webhook_events (id, source, process_id, status, raw_body, processed_at, created_at)
        VALUES (
          gen_random_uuid(),
          ${'bancard'}::"webhook_source",
          ${payload.process_id},
          ${payload.status},
          ${JSON.stringify(payload)}::jsonb,
          NOW(),
          NOW()
        )
        ON CONFLICT (process_id, status) DO NOTHING
      `

      if (isNew === 0) {
        // Duplicate webhook — already processed, return silently
        return
      }

      // ── Step 2: Find the associated payment ───────────────────────────
      const payment = await paymentRepo.findByBancardProcessId(payload.process_id)
      if (!payment) {
        // Webhook for unknown payment — still a success (return 200)
        return
      }

      // ── Step 3: Apply status mapping ──────────────────────────────────
      if (payload.status === 'approved') {
        await paymentRepo.updateStatus(payment.id, 'approved', new Date())
        await draftRepo.update(payment.draftId, { status: 'payment_confirmed' })
      } else if (payload.status === 'rejected' || payload.status === 'cancelled') {
        await paymentRepo.updateStatus(payment.id, 'declined')
      } else if (payload.status === 'reversed') {
        await paymentRepo.updateStatus(payment.id, 'declined')
      }
      // All other statuses: no-op (webhook_event is inserted but no payment/draft change)
    })

    return { received: true }
  }

  return { processBancardWebhook }
}

export type WebhookService = ReturnType<typeof createWebhookService>
