import type { EmailPayload } from './base-layout.js'
import { baseLayout, ctaButton } from './base-layout.js'

export function invitationTemplate(params: {
  inviterName?: string | undefined
  tenantName: string
  inviteUrl: string
  expiresInDays?: number | undefined
}): EmailPayload {
  const { inviterName, tenantName, inviteUrl, expiresInDays } = params

  const senderName = inviterName ?? 'Un administrador'

  const expiryText =
    expiresInDays !== undefined
      ? `<p style="margin:0 0 16px;font-size:14px;color:#737380;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Esta invitación expira en ${expiresInDays} días.</p>`
      : ''

  const content = `
    <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Has recibido una invitación</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${senderName} te ha invitado a unirte a <strong>${tenantName}</strong>.</p>
    ${expiryText}
    ${ctaButton('Aceptar invitación', inviteUrl)}
    <p style="margin:16px 0 0;font-size:12px;color:#737380;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Si no esperabas esta invitación, puedes ignorar este correo.</p>
  `

  return {
    subject: `Te han invitado a ${tenantName}`,
    html: baseLayout(content),
  }
}
