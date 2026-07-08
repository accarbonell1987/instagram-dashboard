import { Resend } from 'resend'
import { InternalError } from '../../errors.js'
import type { EmailAdapter, EmailSendParams, PlanChangeNotificationParams } from './types.js'
import { planChangeTemplate } from './templates/index.js'

export class ResendEmailAdapter implements EmailAdapter {
  private readonly resend: Resend

  constructor(resendApiKey: string) {
    this.resend = new Resend(resendApiKey)
  }

  async send(params: EmailSendParams): Promise<void> {
    const payload: Parameters<typeof this.resend.emails.send>[0] = {
      from: 'noreply@corehub.com',
      to: params.to,
      subject: params.subject,
      html: params.html,
    }
    if (params.text !== undefined) {
      payload.text = params.text
    }
    const { error } = await this.resend.emails.send(payload)

    if (error) {
      throw new InternalError('email.send_failed', error.message)
    }
  }

  async sendPlanChangeNotification(params: PlanChangeNotificationParams): Promise<void> {
    const { to, tenantName, tenantSlug, fromPlanId, toPlanId, requesterEmail } = params
    const { subject, html } = planChangeTemplate({ tenantName, tenantSlug, fromPlanId, toPlanId, requesterEmail })
    const { error } = await this.resend.emails.send({
      from: 'noreply@corehub.com',
      to,
      subject,
      html,
    })

    if (error) {
      throw new InternalError('email.send_failed', error.message)
    }
  }
}
