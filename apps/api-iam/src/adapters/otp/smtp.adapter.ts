import nodemailer from 'nodemailer'
import { otpTemplate } from '../email/templates/index.js'
import type { OtpAdapter, OtpSendParams } from './types.js'

export class SmtpOtpAdapter implements OtpAdapter {
  private readonly transporter: ReturnType<typeof nodemailer.createTransport>
  private readonly from: string

  constructor(host: string, port: number, from: string) {
    this.from = from
    this.transporter = nodemailer.createTransport({ host, port, secure: false })
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
