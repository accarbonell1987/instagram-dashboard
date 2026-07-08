import { describe, it, expect, afterEach, vi } from 'vitest'
import { StubOtpAdapter } from './stub.adapter.js'
import { createMemoryLogger } from '../../test-helpers/logger.js'

describe('StubOtpAdapter', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('logs OTP STUB message with purpose, channel, identifier, and code', async () => {
    const { logger, getRecords } = createMemoryLogger()
    const adapter = new StubOtpAdapter(logger)
    await adapter.send({
      purpose: 'login',
      channel: 'email',
      identifier: 'alice@example.com',
      code: '123456',
    })

    const records = getRecords()
    expect(records).toHaveLength(1)
    const record = records[0] as Record<string, unknown>
    expect(record['category']).toBe('otp')
    expect(record['event']).toBe('otp_stub_emitted')
    expect(record['purpose']).toBe('login')
    expect(record['channel']).toBe('email')
    expect(record['identifier']).toBe('alice@example.com')
    expect(record['otp']).toBe('123456')
  })

  it('logs correctly for sms channel', async () => {
    const { logger, getRecords } = createMemoryLogger()
    const adapter = new StubOtpAdapter(logger)
    await adapter.send({
      purpose: 'signup-rep',
      channel: 'sms',
      identifier: '+595991234567',
      code: '654321',
    })

    const records = getRecords()
    expect(records).toHaveLength(1)
    const record = records[0] as Record<string, unknown>
    expect(record['category']).toBe('otp')
    expect(record['event']).toBe('otp_stub_emitted')
    expect(record['purpose']).toBe('signup-rep')
    expect(record['channel']).toBe('sms')
    expect(record['identifier']).toBe('+595991234567')
    expect(record['otp']).toBe('654321')
  })
})
