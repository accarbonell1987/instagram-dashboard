import type { InstagramAccount, ConnectAccountInput, AgentConfig } from '../../domain/account.js';
import type { InstagramMedia, MediaMetrics, MediaWithMetrics, PaginatedMedia } from '../../domain/media.js';
import type { AccountInsight, DashboardData, InsightSnapshot, NorthStarMetrics } from '../../domain/insight.js';
import type { FilterParams } from '../repository.interface.js';

export interface InstagramRepository {
  // Account
  findAccountByTenantId(tenantId: string): Promise<InstagramAccount | null>;
  findAccountById(accountId: string): Promise<InstagramAccount | null>;
  findAccountWithToken(
    accountId: string,
  ): Promise<{ id: string; igUserId: string; tokenEncrypted: string | null } | null>;
  findAccountsExpiringSoon(
    daysThreshold: number,
  ): Promise<Array<{ id: string; tenantId: string; igUserId: string; tokenEncrypted: string }>>;
  upsertAccount(
    tenantId: string,
    input: ConnectAccountInput,
    accessTokenHash: string,
    tokenEncrypted: string,
    tokenExpiresAt: Date,
  ): Promise<InstagramAccount>;
  disconnectAccount(tenantId: string, userId: string): Promise<InstagramAccount>;
  updateToken(
    accountId: string,
    accessTokenHash: string,
    tokenEncrypted: string,
    tokenExpiresAt: Date,
  ): Promise<void>;
  updateProfile(
    accountId: string,
    data: {
      displayName?: string;
      profilePictureUrl?: string;
      followersCount?: number;
      mediaCount?: number;
    },
  ): Promise<void>;
  updateSyncStatus(accountId: string, status: string, lastSyncAt?: Date): Promise<void>;

  // Agent Config
  getAgentConfig(tenantId: string, userId: string): Promise<AgentConfig | null>;
  saveAgentConfig(tenantId: string, userId: string, config: AgentConfig): Promise<void>;

  // FAL API Key (per-tenant, AES-256-GCM encrypted)
  hasFalApiKey(tenantId: string): Promise<boolean>;
  saveFalApiKey(tenantId: string, encryptedKey: string): Promise<void>;
  getFalApiKeyEncrypted(tenantId: string): Promise<string | null>;

  // Media
  findMediaByIgId(accountId: string, igMediaId: string): Promise<InstagramMedia | null>;
  upsertMedia(
    accountId: string,
    data: {
      igMediaId: string;
      mediaType: string;
      mediaProductType?: string;
      permalink?: string;
      caption?: string;
      thumbnailUrl?: string;
      postedAt: Date;
    },
  ): Promise<InstagramMedia>;
  findMediaById(mediaId: string): Promise<MediaWithMetrics | null>;
  listMedia(accountId: string, params: FilterParams): Promise<PaginatedMedia>;

  // Metrics
  insertMetrics(mediaId: string, metrics: Omit<MediaMetrics, 'syncedAt'>): Promise<void>;
  getLatestMetrics(mediaId: string): Promise<MediaMetrics | null>;

  // Account Insights
  insertAccountInsight(
    accountId: string,
    data: Omit<AccountInsight, 'syncedAt'>,
    period: string,
  ): Promise<void>;
  getLatestAccountInsight(accountId: string): Promise<AccountInsight | null>;
  getAccountInsightHistory(accountId: string, since: Date | null): Promise<InsightSnapshot[]>;
  countAccountInsightHistory(accountId: string): Promise<number>;
  bulkCreateFollowerSnapshots(
    accountId: string,
    snapshots: Array<{ date: Date; followerCount: number; reach: number }>,
  ): Promise<number>;

  // Dashboard Aggregation
  getDashboardData(accountId: string): Promise<DashboardData>;
  getNorthStarMetrics(accountId: string, periodDays: number): Promise<NorthStarMetrics>;

  // Sync Log
  createSyncLog(accountId: string, tenantId: string): Promise<string>;
  updateSyncLog(
    logId: string,
    status: string,
    mediaSynced: number,
    errors?: unknown,
  ): Promise<void>;
  getLatestSyncLog(
    accountId: string,
  ): Promise<{
    id: string;
    status: string;
    startedAt: Date;
    completedAt: Date | null;
    mediaSynced: number;
  } | null>;
}

export { PrismaInstagramRepository } from './instagram.prisma.repository.js';
