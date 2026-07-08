// ─── Token Response (compartido por todas las estrategias) ───

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  /** Duración del token en segundos */
  expiresIn: number;
}

// ─── Storage (donde se persisten los tokens) ────────────────

export interface TokenStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// ─── Auth Strategy (cómo se obtienen/refrescan los tokens) ──

/**
 * Define cómo se obtiene y refresca un token.
 * Cada estrategia encapsula el protocolo de autenticación específico.
 *
 * - OAuthStrategy: client_credentials + refresh_token (OAuth2)
 * - ApiAuthStrategy: POST /login + POST /refresh (API simple)
 */
export interface AuthStrategy {
  /** Solicita un token nuevo (login inicial o client_credentials) */
  requestToken(): Promise<TokenResponse>;
  /** Refresca un token existente usando el refresh token */
  refreshToken(currentRefreshToken: string): Promise<TokenResponse>;
}

// ─── Token Provider (contrato público) ──────────────────────

/**
 * Contrato para cualquier proveedor de tokens.
 * Los interceptores y servicios dependen de esta interfaz,
 * nunca de una implementación concreta.
 */
export interface ITokenProvider {
  getAccessToken(): Promise<string | null>;
  refreshToken(): Promise<string | null>;
  isExpired(): boolean;
  clear(): void;
}

// ─── Configs por estrategia ─────────────────────────────────

export interface OAuthConfig {
  url: string;
  clientId: string;
  clientSecret: string;
}

export interface ApiAuthConfig {
  loginUrl: string;
  refreshUrl: string;
  credentials: {
    email: string;
    password: string;
  };
}
