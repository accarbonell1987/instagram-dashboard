import type { Logger } from '../../lib/logger.js'
import type { EmailAdapter, EmailSendParams, PlanChangeNotificationParams } from './types.js'

export class StubEmailAdapter implements EmailAdapter {
  constructor(private readonly logger: Logger) {}

  async send(params: EmailSendParams): Promise<void> {
    const { to, subject } = params
    this.logger.info(
      { category: 'email', event: 'email_stub_sent', to, subject },
      '[EMAIL STUB]',
    )
  }

  async sendPlanChangeNotification(params: PlanChangeNotificationParams): Promise<void> {
    const { to, tenantName, tenantSlug, fromPlanId, toPlanId, requesterEmail } = params
    this.logger.info(
      {
        category: 'email',
        event: 'plan_change_notification_stub_sent',
        to,
        tenantName,
        tenantSlug,
        fromPlanId,
        toPlanId,
        requesterEmail,
      },
      '[EMAIL STUB] plan_change_notification',
    )
  }
}
