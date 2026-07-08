import { describe, it, expect } from 'vitest'
import { StubBancardAdapter } from './stub.adapter.js'

describe('StubBancardAdapter', () => {
  it('returns a processId and a valid stub redirectUrl', async () => {
    const adapter = new StubBancardAdapter()
    const result = await adapter.initiatePayment({
      amount: 150000,
      currency: 'PYG',
      draftId: 'draft-abc',
      returnUrl: 'http://localhost:3001/payment/return',
      description: 'Corehub Starter',
    })

    expect(result.processId).toMatch(/^stub_/)
    expect(result.redirectUrl).toContain(result.processId)
    expect(result.redirectUrl).toContain('localhost:8080/__stub/bancard/approve')
  })

  it('returns expiresAt approximately 30 minutes in the future', async () => {
    const before = Date.now()
    const adapter = new StubBancardAdapter()
    const result = await adapter.initiatePayment({
      amount: 1,
      currency: 'PYG',
      draftId: 'draft-xyz',
      returnUrl: 'http://localhost:3001/return',
      description: 'test',
    })
    const after = Date.now()

    const expectedMin = before + 29 * 60 * 1000
    const expectedMax = after + 31 * 60 * 1000
    expect(result.expiresAt.getTime()).toBeGreaterThan(expectedMin)
    expect(result.expiresAt.getTime()).toBeLessThan(expectedMax)
  })

  it('generates unique processId per call', async () => {
    const adapter = new StubBancardAdapter()
    const params = {
      amount: 1,
      currency: 'PYG',
      draftId: 'draft-1',
      returnUrl: 'http://localhost/return',
      description: 'test',
    }
    const r1 = await adapter.initiatePayment(params)
    const r2 = await adapter.initiatePayment(params)

    expect(r1.processId).not.toBe(r2.processId)
  })
})
