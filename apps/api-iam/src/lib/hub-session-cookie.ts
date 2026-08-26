import { setCookie, deleteCookie } from 'hono/cookie'

import type { Config } from '../config.js'

/**
 * `hub_session` es una cookie de PRESENCIA (no httpOnly) que el middleware de
 * Next lee en cada ruta para mandar a /login sin renderizar nada. No lleva dato
 * sensible: el porton real sigue siendo refresh_token.
 *
 * Por eso necesita `domain`. Cuando el hub y la API viven en subdominios
 * distintos -dev.corehub.guay.pro y dev.api.corehub.guay.pro- una cookie sin
 * ese atributo queda amarrada al host que la puso, y el hub NUNCA la ve: el
 * login termina bien, emite sesion, y el middleware rebota igual a /login.
 *
 * En desarrollo no se notaba porque hub y API compartian `localhost` y las
 * cookies ignoran el puerto. Funcionaba por un accidente de la especificacion.
 *
 * Sin COOKIE_DOMAIN el atributo no se manda, que es el comportamiento previo.
 *
 * refresh_token y device_trust NO usan esto a proposito: solo las lee api-iam,
 * y ensanchar su alcance a todo el dominio seria regalar superficie sin motivo.
 */
function domainOption(config: Config): { domain?: string } {
  return config.COOKIE_DOMAIN ? { domain: config.COOKIE_DOMAIN } : {}
}

export function setHubSessionCookie(c: Parameters<typeof setCookie>[0], config: Config): void {
  setCookie(c, 'hub_session', '1', {
    httpOnly: false,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: config.JWT_REFRESH_TOKEN_TTL_SECONDS,
    ...domainOption(config),
  })
}

/** El borrado tiene que repetir `domain`, o el navegador no encuentra la cookie que puso. */
export function deleteHubSessionCookie(c: Parameters<typeof deleteCookie>[0], config: Config): void {
  deleteCookie(c, 'hub_session', { path: '/', ...domainOption(config) })
}
