import type { Logger } from '../../lib/logger.js'
import type { OtpAdapter, OtpSendParams } from './types.js'

export class StubOtpAdapter implements OtpAdapter {
  constructor(private readonly logger: Logger) {}

  async send(params: OtpSendParams): Promise<void> {
    const { purpose, channel, identifier, code } = params
    this.logger.info(
      { category: 'otp', event: 'otp_stub_emitted', purpose, channel, identifier, otp: code },
      '[OTP STUB]',
    )
  }
}
