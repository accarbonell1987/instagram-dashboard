import nodemailer from 'nodemailer'
import type { EmailAdapter, EmailSendParams, PlanChangeNotificationParams } from './types.js'
import { planChangeTemplate } from './templates/index.js'

export class SmtpEmailAdapter implements EmailAdapter {
  private readonly transporter: ReturnType<typeof nodemailer.createTransport>
  private readonly from: string

  constructor(host: string, port: number, from: string) {
    this.from = from
    this.transporter = nodemailer.createTransport({ host, port, secure: false })
  }

  async send(params: EmailSendParams): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      ...(params.text !== undefined && { text: params.text }),
    })
  }

  async sendPlanChangeNotification(params: PlanChangeNotificationParams): Promise<void> {
    const { to, tenantName, tenantSlug, fromPlanId, toPlanId, requesterEmail } = params
    const { subject, html } = planChangeTemplate({ tenantName, tenantSlug, fromPlanId, toPlanId, requesterEmail })
    await this.transporter.sendMail({ from: this.from, to, subject, html })
  }
}
