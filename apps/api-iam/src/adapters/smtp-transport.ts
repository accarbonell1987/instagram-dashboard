import nodemailer from 'nodemailer'

export type SmtpTransportOptions = {
  host: string
  port: number
  user?: string | undefined
  password?: string | undefined
}

/**
 * Un unico lugar arma el transporte SMTP.
 *
 * El adaptador de email y el de OTP lo construian identico y por separado, asi
 * que arreglar uno dejaba el otro roto — y el roto habria sido el que manda los
 * codigos de login.
 */
export function createSmtpTransport({ host, port, user, password }: SmtpTransportOptions) {
  return nodemailer.createTransport({
    host,
    port,
    // 465 es SMTPS: cifrado desde el saludo. 587 y el 1025 de MailDev arrancan
    // en claro y nodemailer negocia STARTTLS solo cuando `secure` es false.
    secure: port === 465,
    // Sin credenciales no se manda `auth`: MailDev no acepta AUTH y el envio
    // fallaria en desarrollo. Un servidor real como Hostinger las exige.
    ...(user && password ? { auth: { user, pass: password } } : {}),
  })
}
