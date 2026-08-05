import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import cron from 'node-cron'
import { startBackgroundJobs } from './background-jobs.js'
import { purgeAnalyticsEntitlementsCache } from '../lib/entitlements-purge.js'
import { silentLogger } from '../test-helpers/logger.js'
import type { Repositories } from '../repositories/index.js'

vi.mock('node-cron', () => ({
  default: { schedule: vi.fn() },
}))

vi.mock('../lib/entitlements-purge.js', () => ({
  purgeAnalyticsEntitlementsCache: vi.fn(),
}))

function makeRepos(overrides: Record<string, unknown> = {}): Repositories {
  return {
    otpCodeRepo: { deleteExpired: vi.fn() },
    passwordResetTokenRepo: { deleteExpired: vi.fn() },
    idempotencyRepo: { deleteExpired: vi.fn() },
    refreshTokenRepo: { deleteExpired: vi.fn() },
    draftRepo: { deleteExpired: vi.fn() },
    moduleRepository: { sweepExpiredTrials: vi.fn().mockResolvedValue([]) },
    tenantRepo: { sweepUnpaidPending: vi.fn().mockResolvedValue([]) },
    ...overrides,
  } as unknown as Repositories
}

// b1 (5.2): 6th cron job — sweeps expired trial Entitlements and fans out a
// cache purge per affected (tenant, product) pair, so the guard's 60s TTL
// doesn't keep serving a stale allow after expiry.
describe('startBackgroundJobs — sweep-expired-trials (b1, 5.2)', () => {
  const originalNodeEnv = process.env['NODE_ENV']

  beforeEach(() => {
    // The registration guard (`NODE_ENV === 'test'` short-circuits) runs at
    // call time, not import time — safe to override per-test.
    process.env['NODE_ENV'] = 'development'
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env['NODE_ENV'] = originalNodeEnv
  })

  it('registers a 6th cron job on top of the existing 5', () => {
    startBackgroundJobs(makeRepos(), silentLogger, 15)

    expect(cron.schedule).toHaveBeenCalledTimes(7)
  })

  it('schedules the sweep every 15 minutes', () => {
    startBackgroundJobs(makeRepos(), silentLogger, 15)

    const patterns = (cron.schedule as ReturnType<typeof vi.fn>).mock.calls.map(([pattern]) => pattern as string)
    expect(patterns).toContain('*/15 * * * *')
  })

  it('purges the analytics entitlements cache for every tenant/product pair the sweep returns', async () => {
    const repos = makeRepos({
      moduleRepository: {
        sweepExpiredTrials: vi.fn().mockResolvedValue([
          { tenantId: 't1', productId: 'instagram-dashboard' },
          { tenantId: 't2', productId: 'instagram-dashboard' },
        ]),
      },
    })
    startBackgroundJobs(repos, silentLogger, 15)

    const sweepCall = (cron.schedule as ReturnType<typeof vi.fn>).mock.calls.find(
      ([pattern]) => pattern === '*/15 * * * *',
    )
    expect(sweepCall).toBeDefined()
    await (sweepCall as [string, () => Promise<void>])[1]()

    expect(purgeAnalyticsEntitlementsCache).toHaveBeenCalledWith('t1', 'instagram-dashboard')
    expect(purgeAnalyticsEntitlementsCache).toHaveBeenCalledWith('t2', 'instagram-dashboard')
    expect(purgeAnalyticsEntitlementsCache).toHaveBeenCalledTimes(2)
  })

  it('does not purge anything when the sweep finds no expired trials', async () => {
    const repos = makeRepos()
    startBackgroundJobs(repos, silentLogger, 15)

    const sweepCall = (cron.schedule as ReturnType<typeof vi.fn>).mock.calls.find(
      ([pattern]) => pattern === '*/15 * * * *',
    )
    await (sweepCall as [string, () => Promise<void>])[1]()

    expect(purgeAnalyticsEntitlementsCache).not.toHaveBeenCalled()
  })
})

// Task 3.9: 7th cron job — suspends unpaid `pending` tenants past the
// configurable threshold. Reactivation-on-late-confirm is exercised by
// settlement.service.test.ts, not here (it happens through settlePayment).
describe('startBackgroundJobs — sweep-unpaid-tenants (3.9)', () => {
  const originalNodeEnv = process.env['NODE_ENV']

  beforeEach(() => {
    process.env['NODE_ENV'] = 'development'
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env['NODE_ENV'] = originalNodeEnv
  })

  it('schedules the unpaid-tenant sweep daily and forwards the configured threshold', async () => {
    const repos = makeRepos()
    startBackgroundJobs(repos, silentLogger, 15)

    const sweepCall = (cron.schedule as ReturnType<typeof vi.fn>).mock.calls.find(
      ([pattern]) => pattern === '0 4 * * *',
    )
    expect(sweepCall).toBeDefined()
    await (sweepCall as [string, () => Promise<void>])[1]()

    expect(repos.tenantRepo.sweepUnpaidPending).toHaveBeenCalledWith(15)
  })
})
