import { describe, it, expect, afterEach, vi } from 'vitest'
import { StubEmailAdapter } from './stub.adapter.js'
import { createMemoryLogger } from '../../test-helpers/logger.js'

describe('StubEmailAdapter', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('logs EMAIL STUB message with to and subject', async () => {
    const { logger, getRecords } = createMemoryLogger()
    const adapter = new StubEmailAdapter(logger)
    await adapter.send({
      to: 'bob@example.com',
      subject: 'Welcome!',
      html: '<p>Hello</p>',
    })

    const records = getRecords()
    expect(records).toHaveLength(1)
    const record = records[0] as Record<string, unknown>
    expect(record['category']).toBe('email')
    expect(record['event']).toBe('email_stub_sent')
    expect(record['to']).toBe('bob@example.com')
    expect(record['subject']).toBe('Welcome!')
  })

  it('accepts and logs attachment filenames without throwing', async () => {
    const { logger, getRecords } = createMemoryLogger()
    const adapter = new StubEmailAdapter(logger)
    await adapter.send({
      to: 'bob@example.com',
      subject: 'Tu pago ha sido confirmado',
      html: '<p>Hello</p>',
      attachments: [
        { filename: 'factura.pdf', content: Buffer.from('fake'), contentType: 'application/pdf' },
        { filename: 'recibo.pdf', content: Buffer.from('fake'), contentType: 'application/pdf' },
      ],
    })

    const record = getRecords()[0] as Record<string, unknown>
    expect(record['attachmentFilenames']).toEqual(['factura.pdf', 'recibo.pdf'])
  })
})
