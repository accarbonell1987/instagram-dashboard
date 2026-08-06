import { createHash } from 'crypto'
import { nanoid } from 'nanoid'
import type { PrismaClient, Prisma } from '../generated/prisma/client.js'
import { mapPayment } from '../repositories/payment/payment.repository.js'
import type { Payment, PaymentSettlementKind, PaymentStatus } from '../domain/index.js'
import { DEFAULT_PRODUCT_ID } from '../domain/index.js'
import { purgeAnalyticsEntitlementsCache } from '../lib/entitlements-purge.js'
import type { EmailAdapter, PdfAdapter, StorageAdapter } from '../adapters/index.js'
import { paymentConfirmationTemplate } from '../adapters/email/templates/index.js'
import type { Config } from '../config.js'
import { NotFoundError, ValidationError } from '../errors.js'
import type { Logger } from '../lib/logger.js'

export type SettlementServiceDeps = {
  prisma: PrismaClient
  pdfAdapter: PdfAdapter
  storageAdapter: StorageAdapter
  emailAdapter: EmailAdapter
  config: Config
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
  // Present only when the caller supplied its own `tx`: the cache purge and
  // confirmation email are deferred here because the caller's transaction is
  // still open. The caller MUST invoke this after its transaction commits.
  // Absent when settlePayment opened its own transaction — those side
  // effects have already run by the time settlePayment returns.
  finalize?: () => Promise<void>
}

const NOTE_REQUIRED_KINDS: PaymentSettlementKind[] = ['agent_review', 'manual_admin']
// A payment is still open for settlement in these states; anything else has
// already gone through this path once (idempotent no-op on retry).
// 'declined' is included so an agent can reopen a rejected bank-transfer
// payment when the user re-transfers under the same reference (see spec
// "payment-reconciliation" — reject → same-reference retry → confirm).
export const UNSETTLED_STATUSES: PaymentStatus[] = ['pending', 'in_review', 'declined']

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

// Deferred email payload, built inside the tx (needs the freshly-generated PDFs
// and activation token) but sent outside it (best-effort). "Outside it" means
// outside whichever transaction is open when settlePayment returns: its own,
// when it opened one, or the caller's, when the caller supplied `tx` — see
// the `finalize` callback below, which the caller must invoke post-commit.
type ConfirmationEmail = {
  to: string
  ownerName: string
  activationUrl: string
  invoiceBuffer: Buffer
  receiptBuffer: Buffer
}

export function createSettlementService(deps: SettlementServiceDeps) {
  const { prisma, pdfAdapter, storageAdapter, emailAdapter, config, logger } = deps
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
      // (bank-transfer/manual triggers, post-provisioning). Deliberately NOT
      // gated on `!alreadySettled`: a Bancard payment is typically approved by
      // the webhook BEFORE the tenant exists (submit.service.ts provisions it
      // later), so its first real activation opportunity is a second,
      // already-settled settlePayment call once Payment.tenantId is backfilled.
      // Idempotency instead comes from the tenant-status check itself — a
      // repeat call on an already-active tenant is a natural no-op.
      let confirmationEmail: ConfirmationEmail | undefined
      if (decision === 'approved' && raw.tenantId) {
        const tenant = await client.tenant.findUnique({ where: { id: raw.tenantId } })
        if (tenant && (tenant.status === 'pending' || tenant.status === 'suspended')) {
          await client.tenant.update({ where: { id: raw.tenantId }, data: { status: 'active' } })

          const user = await client.user.findFirst({ where: { tenantId: tenant.id, role: 'TenantAdmin' } })
          if (user) {
            const pdfData = {
              tenantName: tenant.name,
              planId: tenant.planId,
              tenantId: tenant.id,
              repEmail: user.email,
              date: new Date().toISOString(),
              amount: raw.amount.toNumber(),
              currency: raw.currency,
            }

            const [invoiceBuffer, receiptBuffer] = await Promise.all([
              pdfAdapter.generate({ type: 'invoice', data: pdfData }),
              pdfAdapter.generate({ type: 'receipt', data: pdfData }),
            ])

            const receiptId = crypto.randomUUID()
            const receiptKey = `tenants/${tenant.id}/documents/${receiptId}.pdf`
            // The invoice document was created as a `status: 'pending'` placeholder
            // by submit.service.ts (you don't invoice what hasn't been paid) —
            // fill it in now. Fall back to creating one if it's missing (e.g. a
            // courtesy/manual activation for a tenant provisioned before this change).
            const invoicePlaceholder = await client.document.findFirst({
              where: { tenantId: tenant.id, type: 'invoice' },
            })
            const invoiceId = invoicePlaceholder?.id ?? crypto.randomUUID()
            const invoiceKey = `tenants/${tenant.id}/documents/${invoiceId}.pdf`

            await Promise.all([
              storageAdapter.upload({ key: invoiceKey, buffer: invoiceBuffer, contentType: 'application/pdf' }),
              storageAdapter.upload({ key: receiptKey, buffer: receiptBuffer, contentType: 'application/pdf' }),
            ])

            await Promise.all([
              invoicePlaceholder
                ? client.document.update({
                    where: { id: invoicePlaceholder.id },
                    data: { storageKey: invoiceKey, status: 'ready' },
                  })
                : client.document.create({
                    data: { id: invoiceId, tenantId: tenant.id, type: 'invoice', storageKey: invoiceKey, status: 'ready' },
                  }),
              client.document.create({
                data: { id: receiptId, tenantId: tenant.id, type: 'receipt', storageKey: receiptKey, status: 'ready' },
              }),
            ])

            // Fresh activation token — the activation email now only goes out here,
            // at settlement, never at submit (submit no longer generates one).
            const rawActivationToken = nanoid(32)
            await client.user.update({
              where: { id: user.id },
              data: {
                activationTokenHash: hashToken(rawActivationToken),
                activationTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                activationTokenUsed: false,
              },
            })

            confirmationEmail = {
              to: user.email,
              ownerName: user.fullName ?? user.email,
              activationUrl: `${config.HUB_BASE_URL}/first-login?token=${rawActivationToken}`,
              invoiceBuffer,
              receiptBuffer,
            }
          }
        }
      }

      return { payment: mapPayment(raw), alreadySettled, tenantId: raw.tenantId ?? undefined, confirmationEmail }
    }

    const result = tx ? await run(tx) : await prisma.$transaction((innerTx) => run(innerTx))

    // Cache purge + confirmation email touch the network (cache, SMTP with PDF
    // attachments) and must never run inside an open transaction — Prisma's
    // interactive-transaction timeout (5000ms) would roll back the payment,
    // tenant-active and activation-token writes AFTER the customer already got
    // a confirmation email whose activation link then doesn't resolve. When
    // settlePayment opened its own transaction above, that transaction has
    // already committed by the time we get here, so it's safe to run these
    // now. When the caller supplied `tx`, its transaction is still open here —
    // defer to the caller via the returned `finalize` callback instead.
    async function finalize(): Promise<void> {
      if (!result.alreadySettled && decision === 'approved' && result.tenantId) {
        purgeAnalyticsEntitlementsCache(result.tenantId, DEFAULT_PRODUCT_ID)
      }

      if (result.confirmationEmail) {
        const { to, ownerName, activationUrl, invoiceBuffer, receiptBuffer } = result.confirmationEmail
        const { subject, html } = paymentConfirmationTemplate({ tenantName: ownerName, activationUrl })
        try {
          await emailAdapter.send({
            to,
            subject,
            html,
            attachments: [
              { filename: 'factura.pdf', content: invoiceBuffer, contentType: 'application/pdf' },
              { filename: 'recibo.pdf', content: receiptBuffer, contentType: 'application/pdf' },
            ],
          })
        } catch (emailError) {
          log.warn(
            { category: 'payment', event: 'confirmation_email_failed', paymentId, err: emailError },
            'confirmation email send failed — tenant is still active, user can request access via first-login',
          )
        }
      }

      log.info(
        { category: 'payment', event: result.alreadySettled ? 'settlement_noop' : 'settlement_completed', paymentId, decision, settlementKind },
        'settlePayment',
      )
    }

    if (tx) {
      return { payment: result.payment, alreadySettled: result.alreadySettled, finalize }
    }

    await finalize()
    return { payment: result.payment, alreadySettled: result.alreadySettled }
  }

  return { settlePayment }
}

export type SettlementService = ReturnType<typeof createSettlementService>
