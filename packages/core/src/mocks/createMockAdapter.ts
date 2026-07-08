import type { AxiosRequestConfig, AxiosResponse } from 'axios';

import type { MockAdapter, MockHandler, MockRequestInfo } from './types';

// ─── URL pattern matching ──────────────────────────────

/**
 * Convierte un patrón de ruta (ej: '/users/:id') en un RegExp
 * que captura los parámetros nombrados.
 *
 * @returns Objeto con el regex y los nombres de los parámetros en orden.
 */
function compilePattern(urlPattern: string): {
  regex: RegExp;
  paramNames: string[];
} {
  const paramNames: string[] = [];

  const regexStr = urlPattern.replace(/:(\w+)/g, (_match, paramName: string) => {
    paramNames.push(paramName);
    return '([^/]+)';
  });

  return {
    regex: new RegExp(`^${regexStr}$`),
    paramNames,
  };
}

/**
 * Intenta matchear una URL contra un patrón compilado.
 *
 * @returns Los parámetros extraídos, o null si no matchea.
 */
function matchUrl(
  url: string,
  pattern: ReturnType<typeof compilePattern>
): Record<string, string> | null {
  const match = pattern.regex.exec(url);
  if (!match) return null;

  const params: Record<string, string> = {};
  pattern.paramNames.forEach((name, index) => {
    const value = match[index + 1];
    if (value !== undefined) {
      params[name] = value;
    }
  });

  return params;
}

/**
 * Extrae la ruta (sin baseURL) de un config de Axios.
 *
 * Axios guarda la URL final en `config.url` y opcionalmente
 * la baseURL en `config.baseURL`. Necesitamos solo el path
 * relativo para matchear contra los handlers.
 */
function extractPath(config: AxiosRequestConfig): string {
  const url = config.url ?? '';
  const baseUrl = config.baseURL ?? '';

  const path = url.startsWith(baseUrl) ? url.slice(baseUrl.length) : url;

  // Separar path de query string
  const questionMarkIndex = path.indexOf('?');
  return questionMarkIndex >= 0 ? path.slice(0, questionMarkIndex) : path;
}

/**
 * Extrae query params de la URL y/o de config.params.
 *
 * Combina ambas fuentes porque Axios puede recibir params
 * tanto en la URL como en el objeto config.
 */
function extractQueryParams(config: AxiosRequestConfig): Record<string, string> {
  const params: Record<string, string> = {};

  // Params de la URL
  const url = config.url ?? '';
  const questionMarkIndex = url.indexOf('?');
  if (questionMarkIndex >= 0) {
    const searchParams = new URLSearchParams(url.slice(questionMarkIndex + 1));
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
  }

  // Params del config (sobreescriben los de la URL)
  if (config.params && typeof config.params === 'object') {
    for (const [key, value] of Object.entries(config.params as Record<string, unknown>)) {
      if (value !== undefined && value !== null) {
        params[key] = typeof value === 'string' ? value : JSON.stringify(value);
      }
    }
  }

  return params;
}

// ─── Mock adapter factory ──────────────────────────────

/**
 * Crea un adapter de Axios que intercepta todas las peticiones
 * y las despacha a los handlers registrados.
 *
 * Los handlers se evalúan en orden: el primer match gana.
 * Si ningún handler matchea, se rechaza con un error 404.
 *
 * @example
 * ```ts
 * const adapter = createMockAdapter([
 *   {
 *     method: 'GET',
 *     urlPattern: '/users',
 *     handler: () => ({ status: 200, data: [{ id: 1, name: 'Alice' }] }),
 *   },
 *   {
 *     method: 'GET',
 *     urlPattern: '/users/:id',
 *     handler: (req) => ({ status: 200, data: { id: Number(req.pathParams.id) } }),
 *   },
 * ]);
 *
 * // Inyectar en un httpClient existente:
 * httpClient.defaults.adapter = adapter;
 * ```
 */
export function createMockAdapter(handlers: MockHandler[]): MockAdapter {
  // Pre-compilar todos los patrones para mejor rendimiento
  const compiledHandlers = handlers.map((handler) => ({
    ...handler,
    method: handler.method.toLowerCase(),
    compiled: compilePattern(handler.urlPattern),
  }));

  return async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
    const method = (config.method ?? 'get').toLowerCase();
    const path = extractPath(config);
    const queryParams = extractQueryParams(config);

    for (const entry of compiledHandlers) {
      if (entry.method !== method) continue;

      const pathParams = matchUrl(path, entry.compiled);
      if (!pathParams) continue;

      const requestInfo: MockRequestInfo = {
        method,
        url: path,
        pathParams,
        queryParams,
        body: config.data
          ? typeof config.data === 'string'
            ? JSON.parse(config.data)
            : config.data
          : undefined,
        config,
      };

      // Simular latencia de red mínima para parecer más realista
      await delay(50);

      const mockResponse = await entry.handler(requestInfo);

      const axiosResponse: AxiosResponse = {
        data: mockResponse.data,
        status: mockResponse.status,
        statusText: getStatusText(mockResponse.status),
        headers: mockResponse.headers ?? {},
        config: config as AxiosResponse['config'],
      };

      // Respetar validateStatus de Axios (default: 2xx es éxito)
      const validateStatus = config.validateStatus ?? ((s: number) => s >= 200 && s < 300);
      if (!validateStatus(mockResponse.status)) {
        const error = Object.assign(
          new Error(`Request failed with status code ${String(mockResponse.status)}`),
          { response: axiosResponse, config, isAxiosError: true }
        );
        throw error;
      }

      return axiosResponse;
    }

    // Ningún handler matcheó
    throw Object.assign(new Error(`Mock: no handler for ${method.toUpperCase()} ${path}`), {
      response: {
        data: { message: `No mock handler for ${method.toUpperCase()} ${path}` },
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config,
      },
      isAxiosError: true,
    });
  };
}

// ─── Utilidades internas ───────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStatusText(status: number): string {
  const statusTexts: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    400: 'Bad Request',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    500: 'Internal Server Error',
  };
  return statusTexts[status] ?? 'Unknown';
}
