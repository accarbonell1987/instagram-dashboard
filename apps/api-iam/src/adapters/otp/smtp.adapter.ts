import { otpTemplate } from '../email/templates/index.js'
import type { OtpAdapter, OtpSendParams } from './types.js'
import type { SmtpTransportOptions } from '../smtp-transport.js'
import { createSmtpTransport } from '../smtp-transport.js'

export type SmtpOtpAdapterOptions = SmtpTransportOptions & { from: string }

export class SmtpOtpAdapter implements OtpAdapter {
  private readonly transporter: ReturnType<typeof createSmtpTransport>
  private readonly from: string

  constructor(options: SmtpOtpAdapterOptions) {
    this.from = options.from
    this.transporter = createSmtpTransport(options)
  }

  async send(params: OtpSendParams): Promise<void> {
    if (params.channel !== 'email') return

    const ttlMinutes = Math.ceil((params.ttlSeconds ?? 300) / 60)
    const { subject, html } = otpTemplate({ code: params.code, expiresInMinutes: ttlMinutes })

    await this.transporter.sendMail({
      from: this.from,
      to: params.identifier,
      subject,
      html,
    })
  }
}
