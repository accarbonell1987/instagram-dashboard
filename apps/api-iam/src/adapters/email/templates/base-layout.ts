export type EmailPayload = {
  subject: string
  html: string
}

export type BaseLayoutOptions = {
  previewText?: string | undefined
}

export function ctaButton(text: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;">
      <tr>
        <td style="background-color:#f59e0b;border-radius:8px;padding:12px 24px;">
          <a href="${url}" style="color:#000000;font-weight:600;font-size:16px;text-decoration:none;display:inline-block;">${text}</a>
        </td>
      </tr>
    </table>`
}

export function baseLayout(content: string, options?: BaseLayoutOptions | undefined): string {
  const previewSpan =
    options?.previewText !== undefined
      ? `<span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${options.previewText}</span>`
      : ''

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Corehub</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    ${previewSpan}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f7;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;">

            <!-- HEADER -->
            <tr>
              <td style="background-color:#18181b;padding:24px 40px;">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color:#27272a;width:28px;height:28px;border-radius:4px;text-align:center;vertical-align:middle;padding:4px 8px;">
                      <span style="color:#ffffff;font-size:16px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">T</span>
                    </td>
                    <td style="padding-left:12px;">
                      <span style="color:#ffffff;font-size:18px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Corehub</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- CONTENT -->
            <tr>
              <td style="background-color:#ffffff;padding:32px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                ${content}
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="background-color:#f4f4f7;padding:20px 40px;text-align:center;">
                <span style="color:#737380;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">© 2025 Corehub. Todos los derechos reservados.</span>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}
