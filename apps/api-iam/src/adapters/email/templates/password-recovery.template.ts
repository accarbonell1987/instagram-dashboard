import type { EmailPayload } from './base-layout.js'
import { baseLayout, ctaButton } from './base-layout.js'

export function passwordRecoveryTemplate(params: {
  resetUrl: string
  expiresInMinutes: number
}): EmailPayload {
  const { resetUrl, expiresInMinutes } = params

  const content = `
    <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Restablecer tu contraseña</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Recibimos una solicitud para restablecer la contraseña de tu cuenta en Corehub.</p>
    ${ctaButton('Restablecer contraseña', resetUrl)}
    <p style="margin:16px 0 8px;font-size:12px;color:#737380;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Este enlace expira en ${expiresInMinutes} minutos.</p>
    <p style="margin:0;font-size:12px;color:#737380;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Si no solicitaste restablecer tu contraseña, puedes ignorar este correo de forma segura.</p>
  `

  return {
    subject: 'Restablecer tu contraseña',
    html: baseLayout(content),
  }
}
