import type { InternalAxiosRequestConfig } from 'axios';

import type { ITokenProvider } from '../../auth/types';

/**
 * Interceptor de request que inyecta el token de autenticación.
 *
 * Antes de cada petición:
 * 1. Obtiene el access token actual del provider
 * 2. Si existe, lo agrega como `Authorization: Bearer <token>`
 * 3. Si no hay token, deja la request pasar sin header de auth
 *
 * El TokenProvider se encarga de devolver un token válido
 * (refrescándolo si es necesario), así que este interceptor
 * solo necesita pedir y adjuntar.
 */
export function createAuthInterceptor(tokenProvider: ITokenProvider) {
  return async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    const accessToken = await tokenProvider.getAccessToken();

    if (accessToken) {
      config.headers.set('Authorization', `Bearer ${accessToken}`);
    }

    return config;
  };
}
