import { createHash } from 'node:crypto';

import { config } from '../../config.js';
import { NotFoundError, ValidationError } from '../../errors.js';
import type { Owner } from '../../shared/domain/owner.js';
import type { Repositories } from '../../shared/lib/create-repositories.js';
import { encryptToken, decryptToken } from '../../shared/lib/crypto.js';
import type { ConnectAccountInput, ConnectionStatus } from '../domain/account.js';
import { InstagramClient } from '../lib/instagram-client.js';

import type { ConnectionRequestService } from './connection-request.service.js';
import { classifyFailure } from './connection-request.service.js';

export class OAuthService {
  /**
   * `connectionRequests` es opcional a proposito: el OAuth funcionaba antes de
   * que el wizard existiera y tiene que seguir funcionando sin el. Cuando esta,
   * el callback cierra el circulo del wizard; cuando no, no cambia nada.
   */
  constructor(
    private readonly repos: Repositories,
    private readonly connectionRequests?: ConnectionRequestService,
  ) {}

  getAuthorizationUrl(tenantId: string, userId: string): string {
    const payload = Buffer.from(
      JSON.stringify({
        tid: tenantId,
        uid: userId,
        exp: Date.now() + 10 * 60 * 1000, // 10 min expiry
      }),
    ).toString('base64url');

    const params = new URLSearchParams({
      client_id: config.IG_APP_ID,
      redirect_uri: config.IG_REDIRECT_URI,
      response_type: 'code',
      scope: 'instagram_business_basic,instagram_business_manage_insights,instagram_business_content_publish',
      state: payload,
      // El error mas comun en Development: el cliente tiene otra cuenta logueada
      // en el navegador y autoriza con esa, que no es la que se agrego como
      // tester. Forzar el login lo obliga a elegir.
      force_reauth: 'true',
    });

    return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
  }

  async handleCallback(
    code: string,
    state: string,
  ): Promise<{ redirectUrl: string; accountId: string }> {
    // Decode and validate state payload
    let payload: { tid: string; uid: string; exp: number };
    try {
      payload = JSON.parse(Buffer.from(state, 'base64url').toString()) as {
        tid: string;
        uid: string;
        exp: number;
      };
    } catch {
      throw new ValidationError('Invalid OAuth state parameter');
    }

    if (!payload.tid) {
      throw new ValidationError('Invalid OAuth state: missing tid field');
    }

    if (Date.now() > payload.exp) {
      throw new ValidationError('OAuth state has expired. Please try again.');
    }

    const tenantId = payload.tid;
    const userId = payload.uid;

    // A partir de aca todo puede fallar por una causa que el CLIENTE puede
    // arreglar: no tiene rol en la app, no acepto la invitacion, o la cuenta es
    // personal. Se registra en su solicitud para que el wizard lo explique en
    // vez de mostrarle el texto crudo de Meta, que no nombra ninguna.
    try {
      // Exchange code for short-lived token
      const shortLived = await InstagramClient.exchangeCodeForToken(code);

      // Exchange for long-lived token (60 days)
      const longLived = await InstagramClient.exchangeForLongLivedToken(
        shortLived.access_token,
      );

      // Hash the token for verification
      const tokenHash = createHash('sha256').update(longLived.access_token).digest('hex');

      // Encrypt the token for storage (needed by sync service)
      const encrypted = encryptToken(longLived.access_token);

      const expiresAt = new Date(Date.now() + longLived.expires_in * 1000);

      // Get basic account info via Instagram Graph API
      const client = new InstagramClient(longLived.access_token);
      const me = await client.getMe();

      // Upsert account with full profile data
      // El cast ciego a 'BUSINESS' | 'CREATOR' guardaba una cuenta PERSONAL como
      // si fuera profesional: la conexion quedaba hecha y las metricas volvian
      // vacias, sin que nada dijera por que.
      if (me.account_type !== 'BUSINESS' && me.account_type !== 'CREATOR') {
        throw new ValidationError('personal_account');
      }

      const connectInput: ConnectAccountInput = {
        userId,
        igUserId: me.id,
        username: me.username,
        accountType: me.account_type,
      };
      if (me.name !== undefined) connectInput.displayName = me.name;
      if (me.profile_picture_url !== undefined) connectInput.profilePictureUrl = me.profile_picture_url;
      if (me.followers_count !== undefined) connectInput.followersCount = me.followers_count;
      if (me.media_count !== undefined) connectInput.mediaCount = me.media_count;

      const account = await this.repos.instagram.upsertAccount(
        { tenantId, userId: connectInput.userId },
        connectInput,
        tokenHash,
        encrypted,
        expiresAt,
      );

      // El wizard queda esperando en `invite_sent` hasta que esto corra: completar
      // el OAuth es la unica prueba de que la invitacion fue aceptada.
      await this.connectionRequests?.markConnected({ tenantId, userId });

      return {
        // The hub routes /apps/:slug by PRODUCT id, and this product is
        // 'instagram-dashboard'. 'dashboard-instagram' was a legacy *module* id,
        // retired by api-iam's seed (retireLegacyInstagramModule) — sending the
        // browser there lands on "no tenés acceso al producto", because no
        // product answers to that name.
        redirectUrl: `${config.POST_AUTH_REDIRECT_URL}/apps/instagram-dashboard?connected=true`,
        accountId: account.id,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.connectionRequests?.recordFailure(
        { tenantId, userId },
        classifyFailure(message),
      );
      throw error;
    }
  }

  async getConnectionStatus(owner: Owner): Promise<ConnectionStatus> {
    const account = await this.repos.instagram.findAccountByOwner(owner);
    if (!account || account.syncStatus === 'disconnected') {
      return { connected: false };
    }
    return {
      connected: true,
      username: account.username,
      accountType: account.accountType,
      tokenExpiresAt: account.tokenExpiresAt.toISOString(),
    };
  }

  async disconnectAccount(owner: Owner): Promise<void> {
    const account = await this.repos.instagram.findAccountByOwner(owner);
    if (!account || account.syncStatus === 'disconnected') {
      throw new NotFoundError('InstagramAccount', owner.tenantId);
    }
    await this.repos.instagram.disconnectAccount(owner);
  }

  // Refreshes tokens expiring within daysThreshold days.
  // Called by the background job in index.ts every 24h.
  async refreshExpiringTokens(daysThreshold = 10): Promise<void> {
    const accounts = await this.repos.instagram.findAccountsExpiringSoon(daysThreshold);
    for (const account of accounts) {
      try {
        const plainToken = decryptToken(account.tokenEncrypted);
        const refreshed = await InstagramClient.refreshToken(plainToken);
        const newHash = createHash('sha256').update(refreshed.access_token).digest('hex');
        const newEncrypted = encryptToken(refreshed.access_token);
        const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
        await this.repos.instagram.updateToken(account.id, newHash, newEncrypted, newExpiresAt);
      } catch (error) {
        // Log and continue — one failed refresh must not block the others
        console.error(`[token-refresh] Failed for account ${account.id}:`, error);
      }
    }
  }
}
