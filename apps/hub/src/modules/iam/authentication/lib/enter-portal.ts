/**
 * Navegacion DURA al portal, una vez que api-iam emitio la sesion.
 *
 * `router.push('/')` no alcanza. Next cachea las respuestas RSC del router, y en
 * la pantalla de login prefetchea `/` mientras el usuario TODAVIA no tiene
 * cookie: el middleware contesta "anda a /login" y esa respuesta queda guardada.
 * Al autenticarse, el push sirve esa copia vieja y rebota al login. Recien
 * cuando la cache expira entra — que es exactamente como se ve el sintoma:
 * "se quedo, me mando al login, y la segunda vez funciono".
 *
 * Una navegacion de documento descarta la cache del cliente, hace que el
 * middleware se reevalue con la cookie nueva y arranca los providers con la
 * sesion ya puesta. Un login es justo el momento donde recargar entero es lo
 * correcto y no un parche.
 */
export function enterPortal(): void {
  window.location.assign('/');
}
