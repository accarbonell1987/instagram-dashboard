import type { EmailPayload } from './base-layout.js'
import { baseLayout } from './base-layout.js'

export function otpTemplate(params: { code: string; expiresInMinutes: number }): EmailPayload {
  const { code, expiresInMinutes } = params

  const content = `
    <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Tu código de verificación</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#737380;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Usa el siguiente código para verificar tu identidad.</p>
    <div style="text-align:center;margin:24px 0;">
      <span style="display:inline-block;background-color:#f4f4f7;border:1px solid #e4e4e9;border-radius:8px;padding:16px 32px;font-family:monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#0a0a0f;">${code}</span>
    </div>
    <p style="margin:0;font-size:12px;color:#737380;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Este código expira en ${expiresInMinutes} minutos.</p>
  `

  return {
    subject: 'Tu código de verificación',
    html: baseLayout(content),
  }
}
