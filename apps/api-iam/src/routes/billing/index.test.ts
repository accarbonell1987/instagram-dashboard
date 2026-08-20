import { describe, it, expect, vi } from 'vitest'
import type { MiddlewareHandler } from 'hono'

import { createBillingRouter } from './index.js'
import type { BillingService } from '../../services/index.js'

/** Stands in for the auth guard, planting the role under test. */
const authAs = (role: string): MiddlewareHandler =>
  async (c, next) => {
    c.set('user', { role, tenantUuid: 'tenant-1', sub: 'user-1' } as never)
    await next()
  }

function makeApp(role: string) {
  const billingService = {
    getPaymentMethod: vi.fn().mockResolvedValue({ paymentMethod: null }),
    requestPaymentMethodChange: vi.fn().mockResolvedValue({ status: 'accepted' }),
    listPayments: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 }),
    getSignedDocumentUrl: vi.fn().mockResolvedValue({ url: 'https://x/y', expiresAt: new Date() }),
  } as unknown as BillingService

  const app = createBillingRouter(billingService, authAs(role))
  // The router has no error handler of its own; in the app one sits above it.
  // Without this the refusal propagates as a throw and the status never forms.
  app.onError((err, c) => {
    const status = (err as { status?: number }).status ?? 500
    return c.json({ error: err.message }, status as 403 | 500)
  })

  return { app, billingService }
}

/**
 * The hub hides /settings/billing behind TenantAdmin. These handlers scoped by
 * tenant and never looked at the role, so any member of the organisation could
 * list its payments and download its invoices by calling the API directly.
 */
describe('billing routes — who may read the money', () => {
  const READS = [
    ['payments', '/billing/payments'],
    ['payment method', '/billing/payment-method'],
    ['an invoice URL', '/billing/documents/doc-1/signed-url'],
  ] as const

  it.each(READS)('refuses %s to a plain member', async (_label, path) => {
    const { app } = makeApp('User')

    const res = await app.request(path)

    expect(res.status).toBe(403)
  })

  it.each(READS)('allows %s to a TenantAdmin', async (_label, path) => {
    const { app } = makeApp('TenantAdmin')

    const res = await app.request(path)

    expect(res.status).toBe(200)
  })

  it('refuses a payment-method change to a plain member', async () => {
    const { app, billingService } = makeApp('User')

    const res = await app.request('/billing/payment-method', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ method: 'transfer' }),
    })

    expect(res.status).toBe(403)
    // Refused before reaching the service, not after.
    expect(billingService.requestPaymentMethodChange).not.toHaveBeenCalled()
  })

  /** Onboarding downloads the contract on a session that is already TenantAdmin. */
  it('still allows a SuperAdmin', async () => {
    const { app } = makeApp('SuperAdmin')

    expect((await app.request('/billing/payments')).status).toBe(200)
  })
})
