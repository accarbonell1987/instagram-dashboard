import type { EmailAdapter, EmailSendParams, PlanChangeNotificationParams } from './types.js'
import { planChangeTemplate } from './templates/index.js'
import type { SmtpTransportOptions } from '../smtp-transport.js'
import { createSmtpTransport } from '../smtp-transport.js'

export type SmtpEmailAdapterOptions = SmtpTransportOptions & { from: string }

export class SmtpEmailAdapter implements EmailAdapter {
  private readonly transporter: ReturnType<typeof createSmtpTransport>
  private readonly from: string

  constructor(options: SmtpEmailAdapterOptions) {
    this.from = options.from
    this.transporter = createSmtpTransport(options)
  }

  async send(params: EmailSendParams): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      ...(params.text !== undefined && { text: params.text }),
      ...(params.attachments !== undefined && { attachments: params.attachments }),
    })
  }

  async sendPlanChangeNotification(params: PlanChangeNotificationParams): Promise<void> {
    const { to, tenantName, tenantSlug, fromPlanId, toPlanId, requesterEmail } = params
    const { subject, html } = planChangeTemplate({ tenantName, tenantSlug, fromPlanId, toPlanId, requesterEmail })
    await this.transporter.sendMail({ from: this.from, to, subject, html })
  }
}
