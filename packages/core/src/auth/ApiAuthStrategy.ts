import type { ApiAuthConfig, AuthStrategy, TokenResponse } from './types';

/**
 * Estrategia de autenticación con API simple (login + refresh).
 *
 * Uso típico: APIs REST que exponen endpoints /login y /refresh
 * con body JSON y respuesta JSON directa.
 *
 * Flujo:
 * 1. requestToken() → POST loginUrl con { email, password }
 * 2. refreshToken() → POST refreshUrl con { refreshToken }
 *
 * Espera respuestas JSON con la forma:
 * { accessToken: string, refreshToken: string, expiresIn: number }
 */
export class ApiAuthStrategy implements AuthStrategy {
  constructor(
    private readonly config: ApiAuthConfig,
    private readonly fetchFn: typeof fetch = fetch
  ) {}

  async requestToken(): Promise<TokenResponse> {
    const response = await this.fetchFn(this.config.loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.config.credentials),
    });

    if (!response.ok) {
      throw new Error(`Login request failed with status ${String(response.status)}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return this.parseResponse(data);
  }

  async refreshToken(currentRefreshToken: string): Promise<TokenResponse> {
    const response = await this.fetchFn(this.config.refreshUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: currentRefreshToken }),
    });

    if (!response.ok) {
      throw new Error(`Refresh request failed with status ${String(response.status)}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return this.parseResponse(data);
  }

  private parseResponse(data: Record<string, unknown>): TokenResponse {
    const accessToken = data['accessToken'] ?? data['access_token'];
    const refreshToken = data['refreshToken'] ?? data['refresh_token'];
    const expiresIn = data['expiresIn'] ?? data['expires_in'];
    return {
      accessToken: typeof accessToken === 'string' ? accessToken : '',
      refreshToken: typeof refreshToken === 'string' ? refreshToken : '',
      expiresIn: typeof expiresIn === 'number' ? expiresIn : 3600,
    };
  }
}
