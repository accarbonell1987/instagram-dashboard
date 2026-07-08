import type { Repositories } from '../lib/create-repositories.js';
import { InstagramClient, extractInsightValue } from '../lib/instagram-client.js';
import { decryptToken } from '../lib/crypto.js';
import { invalidateCache } from '../lib/cache.js';
import {
  AccountNotConnectedError,
  InstagramAPIError,
  RateLimitError,
} from '../errors.js';

// Media-level metrics (v25.0, graph.instagram.com). NOTE: correct names are
// `saved` (not `saves`) and `views` (not `video_views`). `impressions` is still
// valid at media level. Branched by media_type below.
const MEDIA_METRICS_DEFAULT = [
  'reach',
  'saved',
  'shares',
  'likes',
  'comments',
  'total_interactions',
  'views',
];

// REELS support video-specific metrics; keep the shared engagement metrics too.
const MEDIA_METRICS_REELS = [
  'reach',
  'saved',
  'shares',
  'likes',
  'comments',
  'total_interactions',
  'views',
  'ig_reels_avg_watch_time',
  'ig_reels_video_view_total_time',
];

// STORY metrics are limited.
const MEDIA_METRICS_STORY = [
  'reach',
  'views',
  'total_interactions',
  'replies',
];

/**
 * Returns the valid insight metric list for a given media_type / product_type.
 * REELS, STORY and feed media (IMAGE/VIDEO/CAROUSEL_ALBUM) accept different sets.
 */
function metricsForMedia(mediaType: string, productType?: string): string[] {
  const pt = (productType ?? '').toUpperCase();
  const mt = (mediaType ?? '').toUpperCase();
  if (pt === 'REELS') return MEDIA_METRICS_REELS;
  if (pt === 'STORY' || mt === 'STORY') return MEDIA_METRICS_STORY;
  return MEDIA_METRICS_DEFAULT;
}

// Account-level metrics that REQUIRE metric_type=total_value (v25.0).
// NOTE: account level uses "saves" (with s), UNLIKE media level which uses "saved".
const ACCOUNT_METRICS_TOTAL_VALUE = [
  'reach',
  'views',
  'total_interactions',
  'accounts_engaged',
  'likes',
  'comments',
  'saves',
  'shares',
];

// Account-level metrics that must be requested WITHOUT metric_type (time-series).
const ACCOUNT_METRICS_TIMESERIES = ['reach', 'follower_count'];

const DELAY_MS = 200;
const RATE_LIMIT_MAX = 190;

async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelay?: number } = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelay = options.baseDelay ?? 1000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      // Only retry recoverable errors (rate limit, network, API timeout)
      if (error instanceof RateLimitError) {
        const delay =
          (error as any).details?.retryAfterSeconds * 1000 ||
          baseDelay * Math.pow(2, attempt);
        console.warn(
          `Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else if (error instanceof InstagramAPIError) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(
          `Instagram API error, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries}):`,
          error.message,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error; // Non-recoverable, don't retry
      }
    }
  }
  throw new Error('Unreachable');
}

export class SyncService {
  private rateCounters = new Map<string, { count: number; windowStart: number }>();

  constructor(private readonly repos: Repositories) {}

  private checkRateLimit(accountId: string): boolean {
    const now = Date.now();
    const counter = this.rateCounters.get(accountId);
    if (!counter || now - counter.windowStart > 3_600_000) {
      this.rateCounters.set(accountId, { count: 0, windowStart: now });
      return true;
    }
    return counter.count < RATE_LIMIT_MAX;
  }

  private incrementRateCounter(accountId: string): void {
    const counter = this.rateCounters.get(accountId);
    if (counter) counter.count++;
  }

  async triggerSync(tenantId: string, userId: string): Promise<{ syncId: string; status: string }> {
    const account = await this.repos.instagram.findAccountByTenantId(tenantId);
    if (!account) throw new AccountNotConnectedError();

    if (account.syncStatus === 'syncing') {
      return { syncId: '', status: 'already_running' };
    }

    if (!this.checkRateLimit(account.id)) {
      return { syncId: '', status: 'rate_limited' };
    }

    const logId = await this.repos.instagram.createSyncLog(account.id, account.tenantId);
    await this.repos.instagram.updateSyncStatus(account.id, 'syncing');

    // Fire and forget — don't await in MVP
    this.executeSync(account.id, logId).catch(() => {
      // Errors handled inside executeSync
    });

    return { syncId: logId, status: 'started' };
  }

  private async executeSync(accountId: string, logId: string): Promise<void> {
    try {
      // Get account with encrypted token
      const tokenRecord = await this.repos.instagram.findAccountWithToken(accountId);
      if (!tokenRecord || !tokenRecord.tokenEncrypted) {
        await this.repos.instagram.updateSyncLog(logId, 'failed', 0, {
          error: 'No encrypted token found',
        });
        await this.repos.instagram.updateSyncStatus(accountId, 'error');
        return;
      }

      // Decrypt token
      const token = decryptToken(tokenRecord.tokenEncrypted);
      const client = new InstagramClient(token);

      // 1. Get media list
      const mediaList = await client.getMedia(tokenRecord.igUserId, 50);
      this.incrementRateCounter(accountId);
      let synced = 0;

      // 2. For each media, upsert and get insights
      for (const item of mediaList) {
        if (!this.checkRateLimit(accountId)) {
          await this.repos.instagram.updateSyncLog(logId, 'paused', synced);
          await this.repos.instagram.updateSyncStatus(accountId, 'paused');
          return;
        }

        const mediaData: {
          igMediaId: string;
          mediaType: string;
          mediaProductType?: string;
          permalink?: string;
          caption?: string;
          thumbnailUrl?: string;
          postedAt: Date;
        } = {
          igMediaId: item.id,
          mediaType: item.media_type,
          postedAt: new Date(item.timestamp ?? Date.now()),
        };
        if (item.media_product_type !== undefined) {
          mediaData.mediaProductType = item.media_product_type;
        }
        if (item.permalink !== undefined) {
          mediaData.permalink = item.permalink;
        }
        if (item.caption !== undefined) {
          mediaData.caption = item.caption;
        }
        if (item.thumbnail_url !== undefined) {
          mediaData.thumbnailUrl = item.thumbnail_url;
        }

        const media = await this.repos.instagram.upsertMedia(accountId, mediaData);

        try {
          const mediaMetrics = metricsForMedia(item.media_type, item.media_product_type);
          const insights = await withRetry(
            () => client.getMediaInsights(item.id, mediaMetrics),
            { maxRetries: 3, baseDelay: 1000 },
          );
          this.incrementRateCounter(accountId);

          let likes = 0;
          let comments = 0;
          let saves = 0;
          let shares = 0;
          let reach = 0;
          let impressions = 0;
          let totalInteractions = 0;
          let videoViews: number | null = null;
          let avgWatchTime: number | null = null;
          let videoViewTotalTime: number | null = null;

          for (const insight of insights) {
            const value = extractInsightValue(insight);
            if (value === null) {
              console.warn(
                `[sync] media ${item.id} (${item.media_type}/${item.media_product_type ?? 'FEED'}): metric "${insight.name}" returned empty`,
              );
              continue;
            }

            switch (insight.name) {
              case 'likes':
                likes = value;
                break;
              case 'comments':
                comments = value;
                break;
              // v25.0: media-level "saved" (was "saves")
              case 'saved':
                saves = value;
                break;
              case 'shares':
                shares = value;
                break;
              case 'reach':
                reach = value;
                break;
              case 'impressions':
                impressions = value;
                break;
              case 'total_interactions':
                totalInteractions = value;
                break;
              // v25.0: "views" replaces deprecated "video_views"
              case 'views':
                videoViews = value;
                break;
              case 'ig_reels_avg_watch_time':
                avgWatchTime = value;
                break;
              case 'ig_reels_video_view_total_time':
                videoViewTotalTime = value;
                break;
              default:
                break;
            }
          }

          await this.repos.instagram.insertMetrics(media.id, {
            likes,
            comments,
            saves,
            shares,
            reach,
            impressions,
            totalInteractions,
            videoViews,
            avgWatchTime,
            videoViewTotalTime,
          });
          synced++;
        } catch (err) {
          // Individual media insight failure shouldn't kill the whole sync
          console.error(
            `Failed to sync insights for media ${item.id}:`,
            err instanceof Error ? err.message : String(err),
          );
        }

        // Rate limit: delay between calls
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }

      // 3. Get account insights
      try {
        // 3a. Time-series metrics (no metric_type): reach, follower_count
        //     IG returns daily values for the last ~30 days — backfill all of them.
        let timeseriesInserted = 0;
        const timeseriesInsights = await withRetry(
          () =>
            client.getAccountInsights(
              tokenRecord.igUserId,
              ACCOUNT_METRICS_TIMESERIES,
              'day',
            ),
          { maxRetries: 3, baseDelay: 1000 },
        );
        this.incrementRateCounter(accountId);

        // Collect all date→value maps from the time-series response
        type DateKey = string; // ISO date YYYY-MM-DD
        const dates = new Map<DateKey, { reach: number; followerCount: number | null }>();

        for (const insight of timeseriesInsights) {
          const values = insight.values ?? [];
          for (const entry of values) {
            const dateKey = (entry.end_time ?? '').slice(0, 10);
            if (!dateKey) continue;
            const v = typeof entry.value === 'number' ? entry.value : 0;
            let bucket = dates.get(dateKey);
            if (!bucket) {
              bucket = { reach: 0, followerCount: null };
              dates.set(dateKey, bucket);
            }
            if (insight.name === 'reach') bucket.reach = v;
            if (insight.name === 'follower_count') bucket.followerCount = v > 0 ? v : null;
          }
        }

        // Insert one row per date from the time-series data
        for (const [dateKey, bucket] of dates) {
          await this.repos.instagram.insertAccountInsight(
            accountId,
            {
              period: 'day',
              impressions: 0,
              reach: bucket.reach,
              profileViews: 0,
              followerCount: bucket.followerCount,
              likes: 0,
              comments: 0,
              saves: 0,
              shares: 0,
            },
            'day',
            new Date(dateKey + 'T12:00:00Z'),
          );
          timeseriesInserted++;
        }
        if (timeseriesInserted > 0) {
          console.log(`[sync] backfilled ${String(timeseriesInserted)} daily account insight rows from time series`);
        }

        // 3b. Engagement snapshot with metric_type=total_value (single daily value)
        const totalValueInsights = await withRetry(
          () =>
            client.getAccountInsights(
              tokenRecord.igUserId,
              ACCOUNT_METRICS_TOTAL_VALUE,
              'lifetime',
              'total_value',
            ),
          { maxRetries: 3, baseDelay: 1000 },
        );
        this.incrementRateCounter(accountId);

        let profileViews = 0;
        let likes = 0;
        let comments = 0;
        let saves = 0;
        let shares = 0;

        for (const insight of totalValueInsights) {
          const value = extractInsightValue(insight);
          if (value === null) {
            console.warn(
              `[sync] account ${tokenRecord.igUserId}: metric "${insight.name}" returned empty`,
            );
            continue;
          }
          switch (insight.name) {
            case 'views':
              profileViews = value;
              break;
            case 'likes':
              likes = value;
              break;
            case 'comments':
              comments = value;
              break;
            case 'saves':
              saves = value;
              break;
            case 'shares':
              shares = value;
              break;
            default:
              break;
          }
        }

        // Upsert today's snapshot row with the total_value metrics
        await this.repos.instagram.insertAccountInsight(
          accountId,
          {
            period: 'day',
            impressions: 0,
            reach: 0,
            profileViews,
            followerCount: null,
            likes,
            comments,
            saves,
            shares,
          },
          'day',
        );
      } catch (err) {
        console.error(
          'Failed to sync account insights:',
          err instanceof Error ? err.message : String(err),
        );
      }

      // 4. Refresh profile metadata (name, picture, follower count from getMe)
      try {
        const me = await client.getMe();
        await this.repos.instagram.updateProfile(accountId, {
          ...(me.name !== undefined ? { displayName: me.name } : {}),
          ...(me.profile_picture_url !== undefined ? { profilePictureUrl: me.profile_picture_url } : {}),
          ...(me.followers_count !== undefined ? { followersCount: me.followers_count } : {}),
          ...(me.media_count !== undefined ? { mediaCount: me.media_count } : {}),
        });
      } catch (err) {
        console.error(
          'Failed to refresh profile metadata:',
          err instanceof Error ? err.message : String(err),
        );
      }

      await this.repos.instagram.updateSyncLog(logId, 'completed', synced);
      await this.repos.instagram.updateSyncStatus(accountId, 'idle', new Date());

      // Invalidate dashboard cache after successful sync
      invalidateCache(`dashboard:${accountId}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown sync error';
      await this.repos.instagram.updateSyncLog(logId, 'failed', 0, {
        error: errorMessage,
      });
      await this.repos.instagram.updateSyncStatus(accountId, 'error');
    }
  }

  async backfillFollowerHistory(
    tenantId: string,
    userId: string,
  ): Promise<{ inserted: number }> {
    const account = await this.repos.instagram.findAccountByTenantId(tenantId);
    if (!account) throw new AccountNotConnectedError();

    const tokenRecord = await this.repos.instagram.findAccountWithToken(account.id);
    if (!tokenRecord?.tokenEncrypted) throw new AccountNotConnectedError();

    const token = decryptToken(tokenRecord.tokenEncrypted);
    const client = new InstagramClient(token);

    const until = new Date();
    // Always fetch the full 730-day window — bulkCreateFollowerSnapshots deduplicates
    // by date, so re-running this is safe and idempotent.
    const since = new Date(Date.now() - 730 * 86_400_000);

    const history = await client.getFollowerCountHistory(tokenRecord.igUserId, since, until);
    const inserted = await this.repos.instagram.bulkCreateFollowerSnapshots(account.id, history);

    invalidateCache(`dashboard:${account.id}`);

    return { inserted };
  }

  async getSyncStatus(tenantId: string, userId: string): Promise<{
    status: string;
    lastSyncAt: string | null;
    mediaCount: number;
    nextSyncAvailableAt: string | null;
  }> {
    const account = await this.repos.instagram.findAccountByTenantId(tenantId);
    if (!account) throw new AccountNotConnectedError();

    const lastLog = await this.repos.instagram.getLatestSyncLog(account.id);
    const canSync = this.checkRateLimit(account.id);

    return {
      status: account.syncStatus,
      lastSyncAt: account.lastSyncAt?.toISOString() ?? null,
      mediaCount: lastLog?.mediaSynced ?? 0,
      nextSyncAvailableAt: canSync
        ? null
        : new Date(Date.now() + 3_600_000).toISOString(),
    };
  }
}
