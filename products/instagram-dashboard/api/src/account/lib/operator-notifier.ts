import nodemailer from 'nodemailer';

import type { Config } from '../../config.js';

/**
 * Avisa al operador de la plataforma que llego una solicitud de conexion.
 *
 * El alta como Instagram Tester la hace una sola persona en el App Dashboard de
 * Meta, y no hay API publica para automatizarla. Sin este aviso, la bandeja
 * funciona pero depende de que alguien se acuerde de mirarla mientras un cliente
 * espera.
 *
 * NOTA sobre la duplicacion: la logica del transporte espeja la de
 * `apps/api-iam/src/adapters/smtp-transport.ts`. Son dos deployables distintos y
 * extraer un paquete para veinte lineas y dos consumidores cuesta mas de lo que
 * ahorra. Si aparece un tercero, ahi si conviene el paquete.
 */
export interface OperatorNotifier {
  connectionRequested(params: { username: string; tenantId: string }): Promise<void>;
}

/** No manda nada. Es lo que corre si falta configuracion de correo. */
export class NoopOperatorNotifier implements OperatorNotifier {
  connectionRequested(): Promise<void> {
    return Promise.resolve();
  }
}

export class EmailOperatorNotifier implements OperatorNotifier {
  private readonly transporter: nodemailer.Transporter;

  constructor(
    private readonly to: string,
    private readonly from: string,
    smtp: { host: string; port: number; user?: string | undefined; password?: string | undefined },
  ) {
    this.transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      // 465 cifra desde el saludo; 587 y el 1025 de MailDev negocian STARTTLS.
      secure: smtp.port === 465,
      // MailDev rechaza el comando AUTH, asi que mandarlo vacio rompe desarrollo.
      ...(smtp.user && smtp.password ? { auth: { user: smtp.user, pass: smtp.password } } : {}),
    });
  }

  async connectionRequested({ username, tenantId }: { username: string; tenantId: string }): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: this.to,
      subject: `Instagram: conectar @${username}`,
      text: [
        `El usuario @${username} pidio conectar su cuenta de Instagram.`,
        `Tenant: ${tenantId}`,
        '',
        'Que hacer:',
        '1. developers.meta.com → tu App → App Roles → Roles → Add People',
        `2. Agregar "${username}" como Instagram Tester`,
        '3. Marcar la solicitud como enviada en el panel de administracion',
        '',
        'El cliente ve el estado en su pantalla y recibe las instrucciones para',
        'aceptar la invitacion apenas la marques.',
      ].join('\n'),
    });
  }
}

/**
 * Devuelve el notificador que la configuracion permita.
 *
 * Sin credenciales devuelve el Noop en vez de fallar: que no haya correo
 * configurado no puede impedir que un cliente cree su solicitud. El aviso es
 * una comodidad del operador; la solicitud es el dato.
 */
export function createOperatorNotifier(config: Config): OperatorNotifier {
  const { OPERATOR_EMAIL, EMAIL_FROM, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = config;
  if (!OPERATOR_EMAIL || !EMAIL_FROM || !SMTP_HOST) return new NoopOperatorNotifier();
  return new EmailOperatorNotifier(OPERATOR_EMAIL, EMAIL_FROM, {
    host: SMTP_HOST,
    port: SMTP_PORT,
    user: SMTP_USER,
    password: SMTP_PASSWORD,
  });
}
