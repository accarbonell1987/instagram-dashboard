import { nanoid } from 'nanoid'
import cron from 'node-cron'
import type { Logger } from '../lib/logger.js'
import type { Repositories } from '../repositories/index.js'
import { purgeAnalyticsEntitlementsCache } from '../lib/entitlements-purge.js'

export function startBackgroundJobs(repos: Repositories, logger: Logger, unpaidPaymentSuspendDays: number): void {
  if (process.env['NODE_ENV'] === 'test') return

  async function runJob(jobName: string, fn: () => Promise<unknown>): Promise<void> {
    const runId = nanoid()
    const start = Date.now()
    logger.debug({ category: 'job', event: 'job_started', job: jobName, runId }, 'job_started')
    try {
      await fn()
      logger.info({ category: 'job', event: 'job_completed', job: jobName, runId, durationMs: Date.now() - start }, 'job_completed')
    } catch (error) {
      logger.error({ category: 'job', event: 'job_failed', job: jobName, runId, err: error }, 'job_failed')
    }
  }

  cron.schedule('*/5 * * * *', () => {
    void runJob('cleanup-otp-codes', () => repos.otpCodeRepo.deleteExpired())
  })

  cron.schedule('*/10 * * * *', () => {
    void runJob('cleanup-password-reset-tokens', () => repos.passwordResetTokenRepo.deleteExpired())
  })

  cron.schedule('0 * * * *', () => {
    void runJob('cleanup-idempotency-keys', () => repos.idempotencyRepo.deleteExpired())
  })

  cron.schedule('0 * * * *', () => {
    void runJob('cleanup-refresh-tokens', () => repos.refreshTokenRepo.deleteExpired())
  })

  cron.schedule('0 3 * * *', () => {
    void runJob('cleanup-drafts', () => repos.draftRepo.deleteExpired())
  })

  // b1 (5.2): expired trial Entitlements are already inactive at read time
  // (resolveEffectiveModules filters expiresAt), so this sweep is hygiene
  // (delete stale rows) + a cache-purge fan-out so the guard's 60s TTL
  // doesn't keep serving a stale allow past expiry.
  cron.schedule('*/15 * * * *', () => {
    void runJob('sweep-expired-trials', async () => {
      const expired = await repos.moduleRepository.sweepExpiredTrials()
      for (const { tenantId, productId } of expired) {
        purgeAnalyticsEntitlementsCache(tenantId, productId)
      }
      return expired
    })
  })

  // Task 3.9: tenants left `pending` with an unsettled bank-transfer payment
  // past the threshold get auto-suspended. Reactivation happens automatically
  // via settlePayment() when an agent later confirms the same payment.
  cron.schedule('0 4 * * *', () => {
    void runJob('sweep-unpaid-tenants', () => repos.tenantRepo.sweepUnpaidPending(unpaidPaymentSuspendDays))
  })
}
