import type { PrismaClient } from '@prisma/client';
import type { InstagramRepository } from './index.js';
import type { InstagramAccount, ConnectAccountInput, AgentConfig } from '../../domain/account.js';
import type { InstagramMedia, MediaMetrics, MediaWithMetrics, PaginatedMedia } from '../../domain/media.js';
import type { AccountInsight, DashboardData, FormatBreakdown, HeatmapCell, InsightResult, InsightSnapshot, NorthStarMetric, NorthStarMetrics } from '../../domain/insight.js';
import type { FilterParams } from '../repository.interface.js';
import { NotFoundError } from '../../errors.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaAccount = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaMedia = Record<string, any>;

const DAY_NAMES: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

const SLOT_NAMES: Record<number, string> = {
  0: 'Madrugada (0-6)',
  1: 'Mañana (6-12)',
  2: 'Tarde (12-18)',
  3: 'Noche (18-24)',
};

export class PrismaInstagramRepository implements InstagramRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // ── Account ──────────────────────────────────────────────────────

  async findAccountByTenantId(tenantId: string): Promise<InstagramAccount | null> {
    const record = await this.prisma.instagramAccount.findFirst({
      where: { tenantId },
    });
    if (!record) return null;
    return this.toAccountDomain(record);
  }

  async findAccountByTenantAndUserId(tenantId: string, userId: string): Promise<InstagramAccount | null> {
    const record = await this.prisma.instagramAccount.findFirst({
      where: { tenantId, userId },
    });
    if (!record) return null;
    return this.toAccountDomain(record);
  }

  async findAccountById(accountId: string): Promise<InstagramAccount | null> {
    const record = await this.prisma.instagramAccount.findUnique({
      where: { id: accountId },
    });
    if (!record) return null;
    return this.toAccountDomain(record);
  }

  async findAccountWithToken(
    accountId: string,
  ): Promise<{ id: string; igUserId: string; tokenEncrypted: string | null } | null> {
    const record = await this.prisma.instagramAccount.findUnique({
      where: { id: accountId },
      select: { id: true, igUserId: true, tokenEncrypted: true },
    });
    return record;
  }

  async upsertAccount(
    tenantId: string,
    input: ConnectAccountInput,
    accessTokenHash: string,
    tokenEncrypted: string,
    tokenExpiresAt: Date,
  ): Promise<InstagramAccount> {
    const record = await this.prisma.instagramAccount.upsert({
      where: { tenantId },
      update: {
        igUserId: input.igUserId,
        username: input.username,
        accountType: input.accountType,
        facebookPageId: input.facebookPageId ?? null,
        ...(input.displayName !== undefined && { displayName: input.displayName }),
        ...(input.profilePictureUrl !== undefined && { profilePictureUrl: input.profilePictureUrl }),
        ...(input.followersCount !== undefined && { followersCount: input.followersCount }),
        ...(input.mediaCount !== undefined && { mediaCount: input.mediaCount }),
        accessTokenHash,
        tokenEncrypted,
        tokenExpiresAt,
        syncStatus: 'idle',
      },
      create: {
        tenantId,
        userId: input.userId,
        igUserId: input.igUserId,
        username: input.username,
        accountType: input.accountType,
        facebookPageId: input.facebookPageId ?? null,
        displayName: input.displayName ?? null,
        profilePictureUrl: input.profilePictureUrl ?? null,
        followersCount: input.followersCount ?? null,
        mediaCount: input.mediaCount ?? null,
        accessTokenHash,
        tokenEncrypted,
        tokenExpiresAt,
      },
    });
    return this.toAccountDomain(record);
  }

  async disconnectAccount(tenantId: string, userId: string): Promise<InstagramAccount> {
    const existing = await this.prisma.instagramAccount.findFirst({
      where: {
        tenantId,
        userId,
        syncStatus: { not: 'disconnected' },
      },
    });
    if (!existing) {
      throw new NotFoundError('InstagramAccount', `${tenantId}:${userId}`);
    }
    const record = await this.prisma.instagramAccount.update({
      where: { id: existing.id },
      data: { syncStatus: 'disconnected' },
    });
    return this.toAccountDomain(record);
  }

  async findAccountsExpiringSoon(
    daysThreshold: number,
  ): Promise<Array<{ id: string; tenantId: string; igUserId: string; tokenEncrypted: string }>> {
    const threshold = new Date(Date.now() + daysThreshold * 24 * 60 * 60 * 1000);
    const records = await this.prisma.instagramAccount.findMany({
      where: {
        tokenExpiresAt: { lte: threshold },
        tokenEncrypted: { not: null },
        syncStatus: { not: 'disconnected' },
      },
      select: { id: true, tenantId: true, igUserId: true, tokenEncrypted: true },
    });
    return records.filter((r) => r.tokenEncrypted !== null) as Array<{
      id: string;
      tenantId: string;
      igUserId: string;
      tokenEncrypted: string;
    }>;
  }

  async updateToken(
    accountId: string,
    accessTokenHash: string,
    tokenEncrypted: string,
    tokenExpiresAt: Date,
  ): Promise<void> {
    await this.prisma.instagramAccount.update({
      where: { id: accountId },
      data: { accessTokenHash, tokenEncrypted, tokenExpiresAt },
    });
  }

  async updateSyncStatus(
    accountId: string,
    status: string,
    lastSyncAt?: Date,
  ): Promise<void> {
    await this.prisma.instagramAccount.update({
      where: { id: accountId },
      data: {
        syncStatus: status,
        ...(lastSyncAt !== undefined && { lastSyncAt }),
      },
    });
  }

  // ── Agent Config ──────────────────────────────────────────────────

  async getAgentConfig(tenantId: string, userId: string): Promise<AgentConfig | null> {
    const record = await this.prisma.instagramAccount.findFirst({
      where: { tenantId, userId },
      select: { agentConfig: true },
    });
    if (!record?.agentConfig) return null;
    return record.agentConfig as unknown as AgentConfig;
  }

  async saveAgentConfig(tenantId: string, userId: string, config: AgentConfig): Promise<void> {
    await this.prisma.instagramAccount.update({
      where: { tenantId },
      data: { agentConfig: config as any },
    });
  }

  // ── FAL API Key ───────────────────────────────────────────────────

  async hasFalApiKey(tenantId: string): Promise<boolean> {
    const record = await this.prisma.instagramAccount.findFirst({
      where: { tenantId },
      select: { falApiKeyEncrypted: true },
    });
    return record?.falApiKeyEncrypted !== null && record?.falApiKeyEncrypted !== undefined;
  }

  async saveFalApiKey(tenantId: string, encryptedKey: string): Promise<void> {
    await this.prisma.instagramAccount.update({
      where: { tenantId },
      data: { falApiKeyEncrypted: encryptedKey },
    });
  }

  async getFalApiKeyEncrypted(tenantId: string): Promise<string | null> {
    const record = await this.prisma.instagramAccount.findFirst({
      where: { tenantId },
      select: { falApiKeyEncrypted: true },
    });
    return record?.falApiKeyEncrypted ?? null;
  }

  // ── Media ────────────────────────────────────────────────────────

  async findMediaByIgId(accountId: string, igMediaId: string): Promise<InstagramMedia | null> {
    const record = await this.prisma.instagramMedia.findUnique({
      where: {
        accountId_igMediaId: {
          accountId,
          igMediaId,
        },
      },
    });
    if (!record) return null;
    return this.toMediaDomain(record);
  }

  async upsertMedia(
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
  ): Promise<InstagramMedia> {
    const record = await this.prisma.instagramMedia.upsert({
      where: {
        accountId_igMediaId: {
          accountId,
          igMediaId: data.igMediaId,
        },
      },
      update: {
        mediaType: data.mediaType,
        mediaProductType: data.mediaProductType ?? null,
        permalink: data.permalink ?? null,
        caption: data.caption ?? null,
        thumbnailUrl: data.thumbnailUrl ?? null,
        postedAt: data.postedAt,
      },
      create: {
        accountId,
        igMediaId: data.igMediaId,
        mediaType: data.mediaType,
        mediaProductType: data.mediaProductType ?? null,
        permalink: data.permalink ?? null,
        caption: data.caption ?? null,
        thumbnailUrl: data.thumbnailUrl ?? null,
        postedAt: data.postedAt,
      },
    });
    return this.toMediaDomain(record);
  }

  async findMediaById(mediaId: string): Promise<MediaWithMetrics | null> {
    const record = await this.prisma.instagramMedia.findUnique({
      where: { id: mediaId },
    });
    if (!record) return null;

    const media = this.toMediaDomain(record);
    const metrics = await this.getLatestMetrics(mediaId);

    return { ...media, metrics };
  }

  async listMedia(accountId: string, params: FilterParams): Promise<PaginatedMedia> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    const where = {
      accountId,
      ...(params.mediaProductType !== undefined && { mediaProductType: params.mediaProductType }),
    };

    const [records, total] = await Promise.all([
      this.prisma.instagramMedia.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { postedAt: 'desc' },
      }),
      this.prisma.instagramMedia.count({ where }),
    ]);

    const dataPromises = records.map(async (record) => {
      const media = this.toMediaDomain(record);
      const metrics = await this.getLatestMetrics(media.id);
      return { ...media, metrics };
    });

    const data = await Promise.all(dataPromises);

    return { data, total, page, pageSize };
  }

  // ── Metrics ──────────────────────────────────────────────────────

  async insertMetrics(
    mediaId: string,
    metrics: Omit<MediaMetrics, 'syncedAt'>,
  ): Promise<void> {
    await this.prisma.instagramMediaMetric.create({
      data: {
        mediaId,
        syncedAt: new Date(),
        likes: metrics.likes,
        comments: metrics.comments,
        saves: metrics.saves,
        shares: metrics.shares,
        reach: metrics.reach,
        impressions: metrics.impressions,
        totalInteractions: metrics.totalInteractions,
        videoViews: metrics.videoViews ?? null,
        avgWatchTime: metrics.avgWatchTime ?? null,
        videoViewTotalTime: metrics.videoViewTotalTime ?? null,
      },
    });
  }

  async getLatestMetrics(mediaId: string): Promise<MediaMetrics | null> {
    const record = await this.prisma.instagramMediaMetric.findFirst({
      where: { mediaId },
      orderBy: { syncedAt: 'desc' },
    });
    if (!record) return null;
    return {
      likes: record.likes,
      comments: record.comments,
      saves: record.saves,
      shares: record.shares,
      reach: record.reach,
      impressions: record.impressions,
      totalInteractions: record.totalInteractions,
      videoViews: record.videoViews,
      avgWatchTime: (record.avgWatchTime as number | null) ?? null,
      videoViewTotalTime: (record.videoViewTotalTime as number | null) ?? null,
      syncedAt: record.syncedAt,
    };
  }

  // ── Account Insights ─────────────────────────────────────────────

  async insertAccountInsight(
    accountId: string,
    data: Omit<AccountInsight, 'syncedAt'>,
    period: string,
    syncedAt?: Date,
  ): Promise<void> {
    const effectiveSyncedAt = syncedAt ?? new Date();
    // Upsert by (accountId, syncedAt) — avoid duplicates when backfilling history
    const existing = await this.prisma.instagramAccountInsight.findFirst({
      where: { accountId, syncedAt: effectiveSyncedAt },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.instagramAccountInsight.update({
        where: { id: existing.id },
        data: {
          impressions: data.impressions,
          reach: data.reach,
          profileViews: data.profileViews,
          followerCount: data.followerCount ?? null,
          likes: data.likes,
          comments: data.comments,
          saves: data.saves,
          shares: data.shares,
        },
      });
      return;
    }
    await this.prisma.instagramAccountInsight.create({
      data: {
        accountId,
        period,
        syncedAt: effectiveSyncedAt,
        impressions: data.impressions,
        reach: data.reach,
        profileViews: data.profileViews,
        followerCount: data.followerCount ?? null,
        likes: data.likes,
        comments: data.comments,
        saves: data.saves,
        shares: data.shares,
      },
    });
  }

  async getLatestAccountInsight(accountId: string): Promise<AccountInsight | null> {
    const record = await this.prisma.instagramAccountInsight.findFirst({
      where: { accountId },
      orderBy: { syncedAt: 'desc' },
    });
    if (!record) return null;
    return {
      period: record.period,
      syncedAt: record.syncedAt,
      impressions: record.impressions,
      reach: record.reach,
      profileViews: record.profileViews,
      followerCount: record.followerCount,
      likes: record.likes,
      comments: record.comments,
      saves: record.saves,
      shares: record.shares,
    };
  }

  async getAccountInsightHistory(
    accountId: string,
    since: Date | null,
  ): Promise<InsightSnapshot[]> {
    const records = await this.prisma.instagramAccountInsight.findMany({
      where: {
        accountId,
        ...(since !== null ? { syncedAt: { gte: since } } : {}),
      },
      orderBy: { syncedAt: 'asc' },
      select: {
        syncedAt: true,
        followerCount: true,
        likes: true,
        comments: true,
        saves: true,
        shares: true,
        impressions: true,
        reach: true,
        profileViews: true,
      },
    });

    return records.map((r) => ({
      syncedAt: r.syncedAt,
      followerCount: r.followerCount,
      likes: r.likes,
      comments: r.comments,
      saves: r.saves,
      shares: r.shares,
      impressions: r.impressions,
      reach: r.reach,
      profileViews: r.profileViews,
    }));
  }

  async countAccountInsightHistory(accountId: string): Promise<number> {
    return this.prisma.instagramAccountInsight.count({ where: { accountId } });
  }

  async bulkCreateFollowerSnapshots(
    accountId: string,
    snapshots: Array<{ date: Date; followerCount: number; reach: number }>,
  ): Promise<number> {
    if (snapshots.length === 0) return 0;

    const sorted = [...snapshots].sort((a, b) => a.date.getTime() - b.date.getTime());
    const minDate = sorted[0]!.date;
    const maxDate = sorted[sorted.length - 1]!.date;

    const existing = await this.prisma.instagramAccountInsight.findMany({
      where: { accountId, syncedAt: { gte: minDate, lte: maxDate } },
      select: { syncedAt: true },
    });

    const existingDays = new Set(
      existing.map((r) => r.syncedAt.toISOString().split('T')[0]),
    );

    const toInsert = sorted.filter(
      (s) => !existingDays.has(s.date.toISOString().split('T')[0]),
    );

    if (toInsert.length === 0) return 0;

    await this.prisma.instagramAccountInsight.createMany({
      data: toInsert.map((s) => ({
        accountId,
        period: 'day',
        syncedAt: s.date,
        impressions: 0,
        reach: s.reach,
        profileViews: 0,
        followerCount: s.followerCount,
        likes: 0,
        comments: 0,
        saves: 0,
        shares: 0,
      })),
    });

    return toInsert.length;
  }

  // ── Dashboard Aggregation ────────────────────────────────────────

  async getDashboardData(accountId: string): Promise<DashboardData> {
    const account = await this.prisma.instagramAccount.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new NotFoundError('InstagramAccount', accountId);

    // Get latest account insight for follower count
    const latestAccountInsight = await this.getLatestAccountInsight(accountId);

    // Get latest metrics for all media via raw SQL (subquery for max syncedAt per media)
    // The raw query returns rows with all needed fields including day_of_week and hour_of_day
    const latestMetrics = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        ig_media_id: string;
        media_type: string;
        permalink: string | null;
        caption: string | null;
        thumbnail_url: string | null;
        posted_at: Date;
        saves: number;
        shares: number;
        likes: number;
        comments: number;
        impressions: number;
        reach: number;
        total_interactions: number;
        day_of_week: number;
        hour_of_day: number;
      }>
    >(
      `SELECT
        m.id, m.ig_media_id, m.media_type, m.permalink, m.caption, m.thumbnail_url, m.posted_at,
        mm.saves, mm.shares, mm.likes, mm.comments, mm.impressions, mm.reach, mm.total_interactions,
        EXTRACT(DOW FROM m.posted_at)::int as day_of_week,
        EXTRACT(HOUR FROM m.posted_at)::int as hour_of_day
      FROM instagram_media m
      JOIN instagram_media_metrics mm ON mm.media_id = m.id
      WHERE m.account_id = $1::uuid
        AND mm.synced_at = (
          SELECT MAX(mm2.synced_at) FROM instagram_media_metrics mm2 WHERE mm2.media_id = m.id
        )
      ORDER BY (mm.saves + mm.shares) DESC`,
      accountId,
    );

    // Build ranking (top 20 by saves+shares; N adaptive — full list sent, frontend controls display)
    const ranking = latestMetrics.slice(0, 20).map((m) => ({
      id: m.id,
      igMediaId: m.ig_media_id,
      mediaType: m.media_type,
      permalink: m.permalink,
      caption: m.caption,
      thumbnailUrl: m.thumbnail_url,
      postedAt: m.posted_at.toISOString(),
      saves: m.saves,
      shares: m.shares,
      likes: m.likes,
      comments: m.comments,
      reach: m.reach,
      totalEngagement: m.saves + m.shares,
    }));

    // Build format breakdown
    const formatMap = new Map<
      string,
      {
        savesSum: number;
        sharesSum: number;
        likesSum: number;
        commentsSum: number;
        reachSum: number;
        count: number;
      }
    >();

    for (const m of latestMetrics) {
      const format =
        m.media_type === 'CAROUSEL_ALBUM'
          ? 'Carousel'
          : m.media_type === 'VIDEO'
            ? 'Reel'
            : 'Image';

      const entry = formatMap.get(format) ?? {
        savesSum: 0,
        sharesSum: 0,
        likesSum: 0,
        commentsSum: 0,
        reachSum: 0,
        count: 0,
      };

      entry.savesSum += m.saves;
      entry.sharesSum += m.shares;
      entry.likesSum += m.likes;
      entry.commentsSum += m.comments;
      entry.reachSum += m.reach;
      entry.count += 1;

      formatMap.set(format, entry);
    }

    const formatBreakdown: FormatBreakdown[] = Array.from(formatMap.entries()).map(
      ([format, v]) => ({
        format,
        postCount: v.count,
        avgSaves: Math.round((v.savesSum / v.count) * 10) / 10,
        avgShares: Math.round((v.sharesSum / v.count) * 10) / 10,
        avgLikes: Math.round((v.likesSum / v.count) * 10) / 10,
        avgComments: Math.round((v.commentsSum / v.count) * 10) / 10,
        avgReach: Math.round((v.reachSum / v.count) * 10) / 10,
      }),
    );

    // Build heatmap (7 days × 4 time slots)
    const heatmapGrid = new Map<string, { savesShares: number; count: number }>();

    for (const m of latestMetrics) {
      const dayIndex = m.day_of_week; // 0 = Sunday in EXTRACT(DOW)
      const slotIndex = Math.floor(Math.min(m.hour_of_day, 23) / 6); // 0-3
      const key = `${dayIndex}:${slotIndex}`;

      const cell = heatmapGrid.get(key) ?? { savesShares: 0, count: 0 };
      cell.savesShares += m.saves + m.shares;
      cell.count += 1;
      heatmapGrid.set(key, cell);
    }

    const heatmap: HeatmapCell[] = [];
    for (let day = 0; day < 7; day++) {
      for (let slot = 0; slot < 4; slot++) {
        const cell = heatmapGrid.get(`${day}:${slot}`);
        heatmap.push({
          day: DAY_NAMES[day] ?? `Day ${String(day)}`,
          dayIndex: day,
          slot: SLOT_NAMES[slot] ?? `Slot ${String(slot)}`,
          slotIndex: slot,
          totalSavesShares: cell?.savesShares ?? 0,
          postCount: cell?.count ?? 0,
        });
      }
    }

    // Overview totals
    const totalPosts = latestMetrics.length;
    const totalSaves = latestMetrics.reduce((sum, m) => sum + m.saves, 0);
    const totalShares = latestMetrics.reduce((sum, m) => sum + m.shares, 0);
    const totalImpressions = latestMetrics.reduce((sum, m) => sum + m.impressions, 0);
    const totalReach = latestMetrics.reduce((sum, m) => sum + m.reach, 0);

    // Insight placeholder — generated by InsightService, populated here as default
    const insight: InsightResult = {
      insight: '',
      generatedAt: new Date().toISOString(),
    };

    return {
      period: 'lifetime',
      account: {
        username: account.username,
        displayName: (account as PrismaAccount)['displayName'] as string | null,
        profilePictureUrl: (account as PrismaAccount)['profilePictureUrl'] as string | null,
        accountType: account.accountType,
        followerCount: (account as PrismaAccount)['followersCount'] as number | null
          ?? latestAccountInsight?.followerCount ?? null,
        mediaCount: (account as PrismaAccount)['mediaCount'] as number | null,
      },
      overview: {
        totalPosts,
        totalSaves,
        totalShares,
        totalImpressions,
        totalReach,
      },
      ranking,
      formatBreakdown,
      heatmap,
      insight,
    };
  }

  // ── Sync Log ─────────────────────────────────────────────────────

  async createSyncLog(accountId: string, tenantId: string): Promise<string> {
    const log = await this.prisma.instagramSyncLog.create({
      data: {
        accountId,
        tenantId,
        startedAt: new Date(),
        status: 'running',
      },
    });
    return log.id;
  }

  async updateSyncLog(
    logId: string,
    status: string,
    mediaSynced: number,
    errors?: unknown,
  ): Promise<void> {
    await this.prisma.instagramSyncLog.update({
      where: { id: logId },
      data: {
        status,
        mediaSynced,
        ...(status !== 'running' && { completedAt: new Date() }),
        ...(errors !== undefined && { errors: errors as object }),
      },
    });
  }

  async getLatestSyncLog(
    accountId: string,
  ): Promise<{
    id: string;
    status: string;
    startedAt: Date;
    completedAt: Date | null;
    mediaSynced: number;
  } | null> {
    const record = await this.prisma.instagramSyncLog.findFirst({
      where: { accountId },
      orderBy: { startedAt: 'desc' },
    });
    if (!record) return null;
    return {
      id: record.id,
      status: record.status,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      mediaSynced: record.mediaSynced,
    };
  }

  // ── Private Mappers ──────────────────────────────────────────────

  private toAccountDomain(record: PrismaAccount): InstagramAccount {
    return {
      id: record['id'] as string,
      tenantId: record['tenantId'] as string,
      userId: record['userId'] as string,
      igUserId: record['igUserId'] as string,
      username: record['username'] as string,
      displayName: (record['displayName'] as string | null) ?? null,
      profilePictureUrl: (record['profilePictureUrl'] as string | null) ?? null,
      followersCount: (record['followersCount'] as number | null) ?? null,
      mediaCount: (record['mediaCount'] as number | null) ?? null,
      accountType: record['accountType'] as 'BUSINESS' | 'CREATOR',
      facebookPageId: (record['facebookPageId'] as string | null) ?? null,
      accessTokenHash: record['accessTokenHash'] as string,
      tokenExpiresAt: record['tokenExpiresAt'] as Date,
      syncStatus: record['syncStatus'] as 'idle' | 'syncing' | 'paused' | 'error' | 'disconnected',
      lastSyncAt: (record['lastSyncAt'] as Date | null) ?? null,
      connectedAt: record['connectedAt'] as Date,
    };
  }

  async updateProfile(
    accountId: string,
    data: {
      displayName?: string;
      profilePictureUrl?: string;
      followersCount?: number;
      mediaCount?: number;
    },
  ): Promise<void> {
    await this.prisma.instagramAccount.update({
      where: { id: accountId },
      data: {
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.profilePictureUrl !== undefined && { profilePictureUrl: data.profilePictureUrl }),
        ...(data.followersCount !== undefined && { followersCount: data.followersCount }),
        ...(data.mediaCount !== undefined && { mediaCount: data.mediaCount }),
      },
    });
  }

  private toMediaDomain(record: PrismaMedia): InstagramMedia {
    return {
      id: record['id'] as string,
      accountId: record['accountId'] as string,
      igMediaId: record['igMediaId'] as string,
      mediaType: record['mediaType'] as 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM',
      mediaProductType: (record['mediaProductType'] as 'FEED' | 'REELS' | 'STORY' | null) ?? null,
      permalink: (record['permalink'] as string | null) ?? null,
      caption: (record['caption'] as string | null) ?? null,
      thumbnailUrl: (record['thumbnailUrl'] as string | null) ?? null,
      postedAt: record['postedAt'] as Date,
    };
  }

  async getNorthStarMetrics(accountId: string, periodDays: number): Promise<NorthStarMetrics> {
    const now = new Date();
    const currentStart = new Date(now.getTime() - periodDays * 86_400_000);
    const previousStart = new Date(now.getTime() - 2 * periodDays * 86_400_000);

    const [currentSnapshots, previousSnapshots] = await Promise.all([
      this.getAccountInsightHistory(accountId, currentStart),
      this.getAccountInsightHistory(accountId, previousStart),
    ]);

    const prevSnapshotsFiltered = previousSnapshots.filter(
      (s) => s.syncedAt < currentStart,
    );

    const sumSnapshots = (snapshots: typeof currentSnapshots) =>
      snapshots.reduce(
        (acc, s) => ({
          reach: acc.reach + s.reach,
          saves: acc.saves + s.saves,
          shares: acc.shares + s.shares,
          followerCount: s.followerCount ?? acc.followerCount,
        }),
        { reach: 0, saves: 0, shares: 0, followerCount: null as number | null },
      );

    const current = sumSnapshots(currentSnapshots);
    const previous = sumSnapshots(prevSnapshotsFiltered);

    const followerAtCurrentEnd = currentSnapshots[currentSnapshots.length - 1]?.followerCount ?? 0;
    const followerAtCurrentStart = currentSnapshots[0]?.followerCount ?? followerAtCurrentEnd;
    const followerAtPreviousEnd = prevSnapshotsFiltered[prevSnapshotsFiltered.length - 1]?.followerCount ?? 0;
    const followerAtPreviousStart = prevSnapshotsFiltered[0]?.followerCount ?? followerAtPreviousEnd;

    const currentFollowerGrowth = followerAtCurrentEnd - followerAtCurrentStart;
    const previousFollowerGrowth = followerAtPreviousEnd - followerAtPreviousStart;

    const safeRate = (numerator: number, denominator: number) =>
      denominator > 0 ? (numerator / denominator) * 100 : 0;

    const makeMetic = (curr: number, prev: number): NorthStarMetric => {
      const delta = curr - prev;
      const deltaPercent = prev !== 0 ? (delta / Math.abs(prev)) * 100 : null;
      return { value: curr, previousValue: prev, delta, deltaPercent };
    };

    return {
      reachTotal: makeMetic(current.reach, previous.reach),
      shareRate: makeMetic(
        safeRate(current.shares, current.reach),
        safeRate(previous.shares, previous.reach),
      ),
      saveRate: makeMetic(
        safeRate(current.saves, current.reach),
        safeRate(previous.saves, previous.reach),
      ),
      followerGrowth: makeMetic(currentFollowerGrowth, previousFollowerGrowth),
    };
  }
}
