import { Resend } from 'resend'
import { InternalError } from '../../errors.js'
import { otpTemplate } from '../email/templates/index.js'
import type { OtpAdapter, OtpSendParams } from './types.js'

export class ResendOtpAdapter implements OtpAdapter {
  private readonly resend: Resend

  constructor(resendApiKey: string) {
    this.resend = new Resend(resendApiKey)
  }

  async send(params: OtpSendParams): Promise<void> {
    if (params.channel !== 'email') {
      throw new InternalError('otp.sms_not_supported', 'SMS channel not supported in v1')
    }

    const ttlMinutes = Math.ceil((params.ttlSeconds ?? 300) / 60)
    const { subject, html } = otpTemplate({ code: params.code, expiresInMinutes: ttlMinutes })

    const { error } = await this.resend.emails.send({
      from: 'noreply@corehub.com',
      to: params.identifier,
      subject,
      html,
    })

    if (error) {
      throw new InternalError('otp.email_send_failed', error.message)
    }
  }
}
