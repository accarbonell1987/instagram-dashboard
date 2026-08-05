import type { EmailPayload } from './base-layout.js'
import { baseLayout, ctaButton } from './base-layout.js'

export function paymentConfirmationTemplate(params: {
  tenantName: string
  activationUrl: string
}): EmailPayload {
  const { tenantName, activationUrl } = params

  const content = `
    <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">¡Tu pago ha sido confirmado!</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Hemos verificado el pago de <strong>${tenantName}</strong> y tu empresa ya está activa en Corehub.</p>
    <p style="margin:0 0 24px;font-size:14px;color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Adjuntamos tu factura y recibo de pago. Ya puedes acceder a tu cuenta.</p>
    ${ctaButton('Acceder a mi cuenta', activationUrl)}
  `

  return {
    subject: 'Tu pago ha sido confirmado',
    html: baseLayout(content),
  }
}
