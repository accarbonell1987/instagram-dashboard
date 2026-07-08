import type { EmailPayload } from './base-layout.js'
import { baseLayout } from './base-layout.js'

export function planChangeTemplate(params: {
  tenantName: string
  tenantSlug: string
  fromPlanId: string
  toPlanId: string
  requesterEmail: string
}): EmailPayload {
  const { tenantName, tenantSlug, fromPlanId, toPlanId, requesterEmail } = params

  const content = `
    <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Solicitud de cambio de plan</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Se ha recibido una nueva solicitud de cambio de plan.</p>
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#f4f4f7;border-radius:8px;padding:20px;margin:0 0 16px;">
      <tr>
        <td style="padding:8px 20px;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #e4e4e9;">
                <span style="font-size:12px;color:#737380;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:block;margin-bottom:2px;">Empresa</span>
                <span style="font-size:14px;font-weight:600;color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${tenantName} <span style="font-weight:400;color:#737380;">(${tenantSlug})</span></span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #e4e4e9;">
                <span style="font-size:12px;color:#737380;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:block;margin-bottom:2px;">Solicitado por</span>
                <span style="font-size:14px;font-weight:600;color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${requesterEmail}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #e4e4e9;">
                <span style="font-size:12px;color:#737380;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:block;margin-bottom:2px;">Plan actual</span>
                <span style="font-size:14px;font-weight:600;color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${fromPlanId}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;">
                <span style="font-size:12px;color:#737380;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:block;margin-bottom:2px;">Plan solicitado</span>
                <span style="font-size:14px;font-weight:600;color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${toPlanId}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:12px;color:#737380;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Revisa esta solicitud en el panel de administración y contacta al cliente para coordinar el cambio.</p>
  `

  return {
    subject: 'Solicitud de cambio de plan',
    html: baseLayout(content, { previewText: `${tenantName} solicita cambio de plan: ${fromPlanId} → ${toPlanId}` }),
  }
}
