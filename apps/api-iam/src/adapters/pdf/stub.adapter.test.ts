import { describe, it, expect } from 'vitest'
import { StubPdfAdapter } from './stub.adapter.js'

describe('StubPdfAdapter', () => {
  it('returns a Buffer', async () => {
    const adapter = new StubPdfAdapter()
    const result = await adapter.generate({ type: 'invoice', data: { amount: 100 } })

    expect(result).toBeInstanceOf(Buffer)
  })

  it('returns a non-empty buffer', async () => {
    const adapter = new StubPdfAdapter()
    const result = await adapter.generate({ type: 'contract', data: {} })

    expect(result.length).toBeGreaterThan(0)
  })

  it('buffer starts with %PDF header', async () => {
    const adapter = new StubPdfAdapter()
    const result = await adapter.generate({ type: 'invoice', data: { tenantId: 'abc' } })

    expect(result.toString('utf-8')).toContain('%PDF')
  })

  it('buffer contains serialized data', async () => {
    const adapter = new StubPdfAdapter()
    const data = { invoiceNumber: 'INV-001', total: 99500 }
    const result = await adapter.generate({ type: 'invoice', data })

    expect(result.toString('utf-8')).toContain('INV-001')
  })
})
