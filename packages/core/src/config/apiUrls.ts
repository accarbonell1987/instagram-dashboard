import type { AppEnv } from './env';

export interface ApiUrls {
  v1: string;
  v2: string;
  v3: string;
  filter: string;
}

/**
 * Construye las URLs versionadas de la API a partir del entorno.
 * Centraliza la lógica de composición de URLs para que
 * ni los servicios ni los módulos la calculen por su cuenta.
 */
export function buildApiUrls(env: AppEnv): ApiUrls {
  return {
    v1: `${env.apiUrl}${env.versionV1}`,
    v2: `${env.apiUrl}${env.versionV2}`,
    v3: `${env.apiUrl}${env.versionV3}`,
    filter: `${env.apiUrl}${env.versionV1}`,
  };
}
