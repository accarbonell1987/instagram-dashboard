import type { EmailPayload } from './base-layout.js'
import { baseLayout, ctaButton } from './base-layout.js'

export function activationTemplate(params: {
  tenantName: string
  activationUrl: string
}): EmailPayload {
  const { tenantName, activationUrl } = params

  const content = `
    <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">¡Tu empresa ha sido activada!</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">La empresa <strong>${tenantName}</strong> ha sido registrada exitosamente en Corehub.</p>
    <p style="margin:0 0 24px;font-size:14px;color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Ya puedes acceder a tu cuenta y comenzar a utilizar la plataforma.</p>
    ${ctaButton('Acceder a mi cuenta', activationUrl)}
  `

  return {
    subject: 'Tu empresa ha sido activada',
    html: baseLayout(content),
  }
}
