import type { PrismaClient, Prisma } from '../generated/prisma/client.js'
import { mapPayment } from '../repositories/payment/payment.repository.js'
import type { Payment, PaymentSettlementKind, PaymentStatus } from '../domain/index.js'
import { DEFAULT_PRODUCT_ID } from '../domain/index.js'
import { purgeAnalyticsEntitlementsCache } from '../lib/entitlements-purge.js'
import { NotFoundError, ValidationError } from '../errors.js'
import type { Logger } from '../lib/logger.js'

export type SettlementServiceDeps = {
  prisma: PrismaClient
  logger: Logger
}

export type SettleDecision = 'approved' | 'declined'

export type SettlePaymentParams = {
  paymentId: string
  decision: SettleDecision
  settlementKind: PaymentSettlementKind
  // undefined for the system-triggered gateway_webhook path
  settledBy: string | undefined
  // mandatory for agent_review/manual_admin, unused by gateway_webhook
  note: string | undefined
}

export type SettlePaymentResult = {
  payment: Payment
  alreadySettled: boolean
}

const NOTE_REQUIRED_KINDS: PaymentSettlementKind[] = ['agent_review', 'manual_admin']
// A payment is still open for settlement in these states; anything else has
// already gone through this path once (idempotent no-op on retry).
const UNSETTLED_STATUSES: PaymentStatus[] = ['pending', 'in_review']

export function createSettlementService(deps: SettlementServiceDeps) {
  const { prisma, logger } = deps
  const log = logger.child({ component: 'settlement' })

  async function settlePayment(
    params: SettlePaymentParams,
    tx?: Prisma.TransactionClient,
  ): Promise<SettlePaymentResult> {
    const { paymentId, decision, settlementKind, settledBy, note } = params

    if (NOTE_REQUIRED_KINDS.includes(settlementKind) && !note?.trim()) {
      throw new ValidationError(
        'payment.note_required',
        `note is required for ${settlementKind} settlements`,
      )
    }

    async function run(client: Prisma.TransactionClient | PrismaClient) {
      // Status-guarded conditional update — this is the cross-trigger lock.
      // 0 rows affected means another trigger already settled this payment.
      const guarded = await client.payment.updateMany({
        where: { id: paymentId, status: { in: UNSETTLED_STATUSES } },
        data: {
          status: decision,
          settlementKind,
          settledBy: settledBy ?? null,
          settledAt: new Date(),
          note: note ?? null,
          ...(decision === 'approved' && { confirmedAt: new Date() }),
        },
      })

      const raw = await client.payment.findUnique({ where: { id: paymentId } })
      if (!raw) throw new NotFoundError('payment.not_found')

      const alreadySettled = guarded.count === 0

      // Tenant activation only applies once a tenant exists for this payment
      // (bank-transfer/manual triggers, post-provisioning) — reactivates a
      // suspended tenant the same way as a fresh pending→active activation.
      if (!alreadySettled && decision === 'approved' && raw.tenantId) {
        const tenant = await client.tenant.findUnique({ where: { id: raw.tenantId } })
        if (tenant && (tenant.status === 'pending' || tenant.status === 'suspended')) {
          await client.tenant.update({ where: { id: raw.tenantId }, data: { status: 'active' } })
        }
      }

      return { payment: mapPayment(raw), alreadySettled, tenantId: raw.tenantId ?? undefined }
    }

    const result = tx ? await run(tx) : await prisma.$transaction((innerTx) => run(innerTx))

    // ponytail: invoice/receipt PDF + email delivery at settlement time are
    // deferred (out of budget) — this is the seam: inject pdfAdapter/
    // storageAdapter/emailAdapter later, call outside the tx, gate on `!alreadySettled`.
    if (!result.alreadySettled && decision === 'approved' && result.tenantId) {
      purgeAnalyticsEntitlementsCache(result.tenantId, DEFAULT_PRODUCT_ID)
    }

    log.info({ category: 'payment', event: result.alreadySettled ? 'settlement_noop' : 'settlement_completed', paymentId, decision, settlementKind }, 'settlePayment')

    return { payment: result.payment, alreadySettled: result.alreadySettled }
  }

  return { settlePayment }
}

export type SettlementService = ReturnType<typeof createSettlementService>
