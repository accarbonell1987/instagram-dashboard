import type { AuthStrategy, ITokenProvider, TokenStorage } from './types';

const DEFAULT_STORAGE_PREFIX = 'auth';

/** Almacenamiento en memoria como fallback cuando no hay localStorage */
function createMemoryStorage(): TokenStorage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  };
}

/**
 * Gestión de tokens de autenticación, agnóstico del protocolo.
 *
 * Responsabilidades:
 * - Obtener access token (desde storage o delegando en la estrategia)
 * - Refrescar token cuando expira (delegando en la estrategia)
 * - Almacenar tokens en el storage proporcionado
 * - Deduplicar llamadas concurrentes de refresh
 * - Exponer si el token actual está expirado
 *
 * Dependencias inyectadas:
 * - AuthStrategy: cómo se obtienen/refrescan los tokens (OAuth2, API simple, etc.)
 * - TokenStorage: dónde guardar los tokens (localStorage, sessionStorage, memoria)
 *
 * Esto permite testear sin red y sin localStorage real,
 * y cambiar el protocolo de autenticación sin tocar esta clase.
 */
export class Token implements ITokenProvider {
  private readonly storageKeyAccessToken: string;
  private readonly storageKeyRefreshToken: string;
  private readonly storageKeyExpiresAt: string;
  private refreshPromise: Promise<string | null> | null = null;

  constructor(
    private readonly strategy: AuthStrategy,
    private readonly storage: TokenStorage = createMemoryStorage(),
    storagePrefix: string = DEFAULT_STORAGE_PREFIX
  ) {
    this.storageKeyAccessToken = `${storagePrefix}_access_token`;
    this.storageKeyRefreshToken = `${storagePrefix}_refresh_token`;
    this.storageKeyExpiresAt = `${storagePrefix}_expires_at`;
  }

  async getAccessToken(): Promise<string | null> {
    const storedToken = this.storage.getItem(this.storageKeyAccessToken);

    if (storedToken && !this.isExpired()) {
      return storedToken;
    }

    // Si hay refresh token, intentar refrescar
    const storedRefreshToken = this.storage.getItem(this.storageKeyRefreshToken);
    if (storedRefreshToken) {
      return this.refreshToken();
    }

    // Sin token almacenado: solicitar uno nuevo a la estrategia
    return this.requestNewToken();
  }

  async refreshToken(): Promise<string | null> {
    // Evitar múltiples refresh simultáneos
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.executeRefresh();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  isExpired(): boolean {
    const expiresAt = this.storage.getItem(this.storageKeyExpiresAt);
    if (!expiresAt) return true;

    const expiresAtTimestamp = Number(expiresAt);
    // Consideramos expirado 30 segundos antes para evitar race conditions
    const bufferMilliseconds = 30_000;
    return Date.now() >= expiresAtTimestamp - bufferMilliseconds;
  }

  clear(): void {
    this.storage.removeItem(this.storageKeyAccessToken);
    this.storage.removeItem(this.storageKeyRefreshToken);
    this.storage.removeItem(this.storageKeyExpiresAt);
  }

  private async requestNewToken(): Promise<string | null> {
    try {
      const tokenResponse = await this.strategy.requestToken();
      this.storeTokenResponse(tokenResponse);
      return tokenResponse.accessToken;
    } catch {
      return null;
    }
  }

  private async executeRefresh(): Promise<string | null> {
    const storedRefreshToken = this.storage.getItem(this.storageKeyRefreshToken);
    if (!storedRefreshToken) return null;

    try {
      const tokenResponse = await this.strategy.refreshToken(storedRefreshToken);
      this.storeTokenResponse(tokenResponse);
      return tokenResponse.accessToken;
    } catch {
      // Refresh falló — limpiar tokens y devolver null
      this.clear();
      return null;
    }
  }

  private storeTokenResponse(tokenResponse: { accessToken: string; refreshToken: string; expiresIn: number }): void {
    this.storage.setItem(this.storageKeyAccessToken, tokenResponse.accessToken);
    this.storage.setItem(this.storageKeyRefreshToken, tokenResponse.refreshToken);
    const expiresAtTimestamp = Date.now() + tokenResponse.expiresIn * 1000;
    this.storage.setItem(this.storageKeyExpiresAt, String(expiresAtTimestamp));
  }
}
