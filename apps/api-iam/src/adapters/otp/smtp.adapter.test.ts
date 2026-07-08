import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SmtpOtpAdapter } from './smtp.adapter.js'

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-id' }),
    }),
  },
}))

describe('SmtpOtpAdapter', () => {
  let adapter: SmtpOtpAdapter
  let mockSendMail: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    const nodemailer = await import('nodemailer')
    adapter = new SmtpOtpAdapter('localhost', 1025, 'noreply@corehub.com')
    const transport = vi.mocked(nodemailer.default.createTransport).mock.results[0]?.value as { sendMail: ReturnType<typeof vi.fn> }
    mockSendMail = transport.sendMail
  })

  it('sends email using otpTemplate (branded subject and html)', async () => {
    await adapter.send({
      channel: 'email',
      identifier: 'alice@example.com',
      code: '123456',
      purpose: 'login',
      ttlSeconds: 600,
    })

    expect(mockSendMail).toHaveBeenCalledOnce()
    const call = mockSendMail.mock.calls[0]?.[0] as Record<string, unknown>
    expect(call['to']).toBe('alice@example.com')
    expect(call['subject']).toBe('Tu código de verificación')
    expect(call['html']).toContain('123456')
    expect(call['html']).toContain('Corehub')
  })

  it('includes expiresInMinutes derived from ttlSeconds in html', async () => {
    await adapter.send({
      channel: 'email',
      identifier: 'bob@example.com',
      code: '654321',
      purpose: 'login',
      ttlSeconds: 300, // 5 minutes
    })

    const call = mockSendMail.mock.calls[0]?.[0] as Record<string, unknown>
    expect(call['html']).toContain('5')
  })

  it('returns early for SMS channel without sending', async () => {
    await adapter.send({
      channel: 'sms',
      identifier: '+595981234567',
      code: '999999',
      purpose: 'login',
    })

    expect(mockSendMail).not.toHaveBeenCalled()
  })
})
