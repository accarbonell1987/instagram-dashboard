import { createHash } from 'node:crypto';
import type { Repositories } from '../lib/create-repositories.js';
import { InstagramClient } from '../lib/instagram-client.js';
import { encryptToken, decryptToken } from '../lib/crypto.js';
import { config } from '../config.js';
import { AccountNotConnectedError, NotFoundError, ValidationError } from '../errors.js';
import type { ConnectionStatus } from '../domain/account.js';

export class OAuthService {
  constructor(private readonly repos: Repositories) {}

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
    const connectInput: import('../domain/account.js').ConnectAccountInput = {
      userId,
      igUserId: me.id,
      username: me.username,
      accountType: me.account_type as 'BUSINESS' | 'CREATOR',
    };
    if (me.name !== undefined) connectInput.displayName = me.name;
    if (me.profile_picture_url !== undefined) connectInput.profilePictureUrl = me.profile_picture_url;
    if (me.followers_count !== undefined) connectInput.followersCount = me.followers_count;
    if (me.media_count !== undefined) connectInput.mediaCount = me.media_count;

    const account = await this.repos.instagram.upsertAccount(
      tenantId,
      connectInput,
      tokenHash,
      encrypted,
      expiresAt,
    );

    return {
      redirectUrl: `${config.CORS_ORIGIN}/dashboard-instagram?connected=true`,
      accountId: account.id,
    };
  }

  async getConnectionStatus(tenantId: string, _userId: string): Promise<ConnectionStatus> {
    const account = await this.repos.instagram.findAccountByTenantId(tenantId);
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

  async disconnectAccount(tenantId: string, _userId: string): Promise<void> {
    const account = await this.repos.instagram.findAccountByTenantId(tenantId);
    if (!account || account.syncStatus === 'disconnected') {
      throw new NotFoundError('InstagramAccount', tenantId);
    }
    await this.repos.instagram.disconnectAccount(tenantId, account.userId);
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
