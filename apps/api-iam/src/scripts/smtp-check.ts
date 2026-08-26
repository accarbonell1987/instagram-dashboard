/**
 * Diagnostico de SMTP.
 *
 * Manda un correo real usando createSmtpTransport(), el MISMO transporte que
 * usan el adaptador de email y el de OTP. Probar con un cliente distinto puede
 * pasar mientras el camino real falla.
 *
 *   export SMTP_USER=no-reply@guay.pro
 *   read -rs "SMTP_PASSWORD?Password del buzon: " && export SMTP_PASSWORD && echo
 *   pnpm --filter @corehub/api-iam exec tsx src/scripts/smtp-check.ts vos@ejemplo.com
 *   unset SMTP_PASSWORD
 *
 * La password entra por `read -s`: no se ve al tipearla ni queda en el historial.
 */
import { createSmtpTransport } from '../adapters/smtp-transport.js'

const to = process.argv[2]
const { SMTP_HOST = 'smtp.hostinger.com', SMTP_PORT = '465', SMTP_USER, SMTP_PASSWORD } = process.env

if (!to || !SMTP_USER || !SMTP_PASSWORD) {
  console.error('Faltan datos. Uso:')
  console.error('  SMTP_USER=... SMTP_PASSWORD=... tsx src/scripts/smtp-check.ts <destinatario>')
  process.exit(1)
}

const port = Number(SMTP_PORT)
const transporter = createSmtpTransport({ host: SMTP_HOST, port, user: SMTP_USER, password: SMTP_PASSWORD })

// verify() negocia TLS y autentica SIN mandar nada. Si las credenciales estan
// mal, falla aca y ningun correo sale.
console.log(`Conectando a ${SMTP_HOST}:${port} (secure=${port === 465}) como ${SMTP_USER}...`)
await transporter.verify()
console.log('✅ Conexion, TLS y credenciales OK')

const info = await transporter.sendMail({
  from: SMTP_USER,
  to,
  subject: 'Corehub — prueba de SMTP',
  text: 'Si estas leyendo esto, el transporte SMTP de Corehub funciona.',
})
console.log(`✅ Enviado a ${to} — messageId=${info.messageId}`)
