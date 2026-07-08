import type { AuthStrategy, OAuthConfig, TokenResponse } from './types';

/**
 * Estrategia de autenticación OAuth2 (client_credentials + refresh_token).
 *
 * Uso típico: servicios backend-to-backend o apps con client credentials.
 *
 * Flujo:
 * 1. requestToken() → POST con grant_type=client_credentials
 * 2. refreshToken() → POST con grant_type=refresh_token
 */
export class OAuthStrategy implements AuthStrategy {
  constructor(
    private readonly config: OAuthConfig,
    private readonly fetchFn: typeof fetch = fetch
  ) {}

  async requestToken(): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    return this.doTokenRequest(body);
  }

  async refreshToken(currentRefreshToken: string): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: currentRefreshToken,
    });

    return this.doTokenRequest(body);
  }

  private async doTokenRequest(body: URLSearchParams): Promise<TokenResponse> {
    const response = await this.fetchFn(this.config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`OAuth token request failed with status ${String(response.status)}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? '',
      expiresIn: data.expires_in ?? 3600,
    };
  }
}
