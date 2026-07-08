/**
 * Tipado estricto de variables de entorno.
 * Un solo lugar donde se leen. Ningún otro archivo usa import.meta.env directamente.
 */
export interface AppEnv {
  apiUrl: string;
  authUrl: string;
  clientId: string;
  clientSecret: string;
  versionV1: string;
  versionV2: string;
  versionV3: string;
}

/**
 * Lee y valida las variables de entorno requeridas.
 * Lanza un error descriptivo si falta alguna obligatoria.
 * Proporciona defaults para las versiones de API.
 */
export function loadEnv(): AppEnv {
  const {
    VITE_API_URL,
    VITE_AUTH_URL,
    VITE_CLIENT_ID,
    VITE_CLIENT_SECRET,
    VITE_VERSION_V1 = '/api/v1',
    VITE_VERSION_V2 = '/api/v2',
    VITE_VERSION_V3 = '/api/v3',
  } = import.meta.env;

  const missingVariables: string[] = [];

  if (!VITE_API_URL) missingVariables.push('VITE_API_URL');
  if (!VITE_AUTH_URL) missingVariables.push('VITE_AUTH_URL');
  if (!VITE_CLIENT_ID) missingVariables.push('VITE_CLIENT_ID');
  if (!VITE_CLIENT_SECRET) missingVariables.push('VITE_CLIENT_SECRET');

  if (missingVariables.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVariables.join(', ')}`);
  }

  return {
    apiUrl: VITE_API_URL as string,
    authUrl: VITE_AUTH_URL as string,
    clientId: VITE_CLIENT_ID as string,
    clientSecret: VITE_CLIENT_SECRET as string,
    versionV1: VITE_VERSION_V1 as string,
    versionV2: VITE_VERSION_V2 as string,
    versionV3: VITE_VERSION_V3 as string,
  };
}
