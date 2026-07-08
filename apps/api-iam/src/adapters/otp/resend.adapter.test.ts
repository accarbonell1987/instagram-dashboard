import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ResendOtpAdapter } from './resend.adapter.js'
import { InternalError } from '../../errors.js'

// Mock Resend SDK
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ error: null }),
    },
  })),
}))

describe('ResendOtpAdapter', () => {
  let adapter: ResendOtpAdapter
  let mockSend: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    const { Resend } = await import('resend')
    adapter = new ResendOtpAdapter('test-api-key')
    // Get the mock send function from the mocked instance
    const instance = vi.mocked(Resend).mock.results[0]?.value as { emails: { send: ReturnType<typeof vi.fn> } }
    mockSend = instance.emails.send
  })

  it('sends email using otpTemplate (branded subject and html)', async () => {
    await adapter.send({
      channel: 'email',
      identifier: 'alice@example.com',
      code: '123456',
      purpose: 'login',
      ttlSeconds: 600,
    })

    expect(mockSend).toHaveBeenCalledOnce()
    const call = mockSend.mock.calls[0]?.[0] as Record<string, unknown>
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

    const call = mockSend.mock.calls[0]?.[0] as Record<string, unknown>
    expect(call['html']).toContain('5')
  })

  it('throws InternalError when SMS channel is used', async () => {
    await expect(
      adapter.send({
        channel: 'sms',
        identifier: '+595981234567',
        code: '999999',
        purpose: 'login',
      }),
    ).rejects.toThrow(InternalError)
  })

  it('throws InternalError when Resend returns an error', async () => {
    mockSend.mockResolvedValueOnce({ error: { message: 'API error' } })

    await expect(
      adapter.send({
        channel: 'email',
        identifier: 'fail@example.com',
        code: '000000',
        purpose: 'login',
      }),
    ).rejects.toThrow(InternalError)
  })
})
