export interface EmailSendParams {
  to: string
  subject: string
  html: string
  text?: string
}

export interface PlanChangeNotificationParams {
  to: string
  tenantName: string
  tenantSlug: string
  fromPlanId: string
  toPlanId: string
  requesterEmail: string
}

export interface EmailAdapter {
  send(params: EmailSendParams): Promise<void>
  sendPlanChangeNotification(params: PlanChangeNotificationParams): Promise<void>
}
