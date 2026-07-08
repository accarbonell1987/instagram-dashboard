import type { AxiosError, AxiosInstance } from 'axios';
import { isAxiosError } from 'axios';

import type { ITokenProvider } from '../../auth/types';
import { ServiceError } from '../../errors/ServiceError';

/**
 * Interceptor de response que maneja errores y refresh automático de token.
 *
 * Flujo ante un error:
 * 1. Si NO es un AxiosError → relanza tal cual (error inesperado)
 * 2. Si es 401 y hay token provider:
 *    a. Refresca el token
 *    b. Reintenta la request original con el nuevo token
 *    c. Si el refresh falla o el retry falla → convierte a ServiceError
 * 3. Cualquier otro error HTTP → convierte a ServiceError
 *
 * Esto desacopla la lógica de retry/refresh del servicio concreto.
 */
export function createErrorInterceptor(
  axiosInstance: AxiosInstance,
  tokenProvider: ITokenProvider
) {
  return async (error: unknown): Promise<never> => {
    if (!isAxiosError(error)) {
      throw error;
    }

    const axiosError = error as AxiosError;

    // Intentar refresh automático solo en 401
    if (axiosError.response?.status === 401 && axiosError.config) {
      try {
        const newAccessToken = await tokenProvider.refreshToken();

        if (newAccessToken) {
          // Reintentar la request original con el token nuevo
          axiosError.config.headers.set('Authorization', `Bearer ${newAccessToken}`);
          return await axiosInstance.request(axiosError.config);
        }
      } catch {
        // Refresh falló — caer al ServiceError de abajo
      }
    }

    throw ServiceError.fromAxiosError(axiosError);
  };
}
