import { nanoid } from 'nanoid'
import cron from 'node-cron'
import type { Logger } from '../lib/logger.js'
import type { Repositories } from '../repositories/index.js'

export function startBackgroundJobs(repos: Repositories, logger: Logger): void {
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
}
