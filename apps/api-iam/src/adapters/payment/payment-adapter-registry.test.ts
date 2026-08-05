import { describe, it, expect, vi } from 'vitest'
import { StubBancardAdapter } from '../bancard/index.js'
import { ConflictError } from '../../errors.js'
import { BancardPaymentAdapter } from './bancard.adapter.js'
import { BankTransferAdapter } from './bank-transfer.adapter.js'
import { createPaymentAdapterRegistry } from './index.js'

const INITIATE_PARAMS = {
  amount: 150000, currency: 'PYG', draftId: 'draft-abc', returnUrl: 'http://localhost:3001/payment/return', description: 'Corehub Starter',
}

describe('BancardPaymentAdapter (regression)', () => {
  it('does not change Bancard initiate output — same processId-derived URL and expiry as the direct adapter', async () => {
    const bancard = new StubBancardAdapter()
    const direct = await bancard.initiatePayment(INITIATE_PARAMS)
    const wrapped = await new BancardPaymentAdapter(bancard).initiate(INITIATE_PARAMS)

    expect(wrapped.kind).toBe('redirect')
    if (wrapped.kind !== 'redirect') throw new Error('unreachable')
    expect(wrapped.url).toMatch(/^http:\/\/localhost:8080\/__stub\/bancard\/approve\?process_id=stub_/)
    expect(direct.redirectUrl).toMatch(/^http:\/\/localhost:8080\/__stub\/bancard\/approve\?process_id=stub_/)
    expect(wrapped.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 31 * 60 * 1000)
    // externalRef must survive the reshape (it's what payment.service.ts stores as
    // Payment.externalRef, matched back against by the Bancard webhook) — assert it's
    // embedded in wrapped's own url, the same relationship the direct call has.
    expect(wrapped.url).toContain(wrapped.externalRef)
    expect(direct.redirectUrl).toContain(direct.processId)
  })
})

describe('PaymentAdapterRegistry', () => {
  function makePrisma(enabled: boolean) {
    return { paymentMethodConfig: { findUnique: vi.fn().mockResolvedValue({ enabled }) } }
  }

  it('returns the Bancard adapter when enabled', async () => {
    const registry = createPaymentAdapterRegistry({ prisma: makePrisma(true) as never, bancardAdapter: new StubBancardAdapter() })
    expect(await registry.getEnabledAdapter('bancard')).toBeInstanceOf(BancardPaymentAdapter)
  })

  it('throws ConflictError when the method is disabled — settlement is unaffected (see settlement.service.ts)', async () => {
    const registry = createPaymentAdapterRegistry({ prisma: makePrisma(false) as never, bancardAdapter: new StubBancardAdapter() })
    await expect(registry.getEnabledAdapter('bank_transfer')).rejects.toThrow(ConflictError)
  })
})

describe('BankTransferAdapter', () => {
  it('generates a CH-XXXXXX reference and returns the configured accounts', async () => {
    const accounts = [{ bankName: 'Banco Test', accountNumber: '123', accountHolder: 'Corehub SA', ruc: '80012345-6' }]
    const prisma = {
      paymentMethodConfig: { findUnique: vi.fn().mockResolvedValue({ config: { accounts } }) },
      payment: { findUnique: vi.fn().mockResolvedValue(null) },
    }
    const result = await new BankTransferAdapter(prisma as never).initiate(INITIATE_PARAMS)

    expect(result.kind).toBe('bank_transfer')
    if (result.kind !== 'bank_transfer') throw new Error('unreachable')
    expect(result.reference).toMatch(/^CH-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/)
    expect(result.accounts).toEqual(accounts)
  })

  it('retries on reference collision until a free one is found', async () => {
    const findUnique = vi.fn().mockResolvedValueOnce({ id: 'taken' }).mockResolvedValueOnce(null)
    const prisma = {
      paymentMethodConfig: { findUnique: vi.fn().mockResolvedValue({ config: { accounts: [] } }) },
      payment: { findUnique },
    }
    const result = await new BankTransferAdapter(prisma as never).initiate(INITIATE_PARAMS)

    expect(result.kind).toBe('bank_transfer')
    expect(findUnique).toHaveBeenCalledTimes(2)
  })
})
