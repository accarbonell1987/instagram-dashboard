import type { Repositories } from '../lib/create-repositories.js';
import { AccountNotConnectedError, NotFoundError } from '../errors.js';
import { getCached, setCache } from '../lib/cache.js';
import type { DashboardData, DemographicsData, NorthStarMetrics } from '../domain/insight.js';
import type { MediaWithMetrics, PaginatedMedia } from '../domain/media.js';
import { InstagramClient } from '../lib/instagram-client.js';
import { decryptToken } from '../lib/crypto.js';
import { computeFindings } from './content-intelligence.service.js';

export interface GrowthDataPoint {
  date: string;
  value: number;
}

export class DashboardService {
  constructor(private readonly repos: Repositories) {}

  async getDashboardData(tenantId: string, userId: string): Promise<DashboardData> {
    const account = await this.repos.instagram.findAccountByTenantId(tenantId);
    if (!account) throw new AccountNotConnectedError();

    const cacheKey = `dashboard:${account.id}`;
    const cached = getCached<DashboardData>(cacheKey);
    if (cached) return cached;

    const data = await this.repos.instagram.getDashboardData(account.id);
    const findings = computeFindings(data.formatBreakdown, data.heatmap, data.ranking);
    const result: DashboardData = { ...data, findings };
    setCache(cacheKey, result);
    return result;
  }

  async getDashboardDataWithNorthStar(
    tenantId: string,
    userId: string,
    periodDays: number,
  ): Promise<DashboardData> {
    const base = await this.getDashboardData(tenantId, userId);
    const account = await this.repos.instagram.findAccountByTenantId(tenantId);
    if (!account) throw new AccountNotConnectedError();

    const northStar = await this.repos.instagram.getNorthStarMetrics(account.id, periodDays);
    return { ...base, northStar, lastUpdated: new Date().toISOString() };
  }

  async getGrowthData(
    tenantId: string,
    userId: string,
    metric: string,
    period: string,
  ): Promise<GrowthDataPoint[]> {
    const account = await this.repos.instagram.findAccountByTenantId(tenantId);
    if (!account) throw new AccountNotConnectedError();

    const PERIOD_DAYS: Record<string, number> = {
      '1y': 365,
      '90d': 90,
      '30d': 30,
      '7d': 7,
    };
    const since =
      period === 'all'
        ? null
        : new Date(Date.now() - (PERIOD_DAYS[period] ?? 90) * 86_400_000);

    const snapshots = await this.repos.instagram.getAccountInsightHistory(account.id, since);

    return snapshots.map((snap) => ({
      date: snap.syncedAt.toISOString(),
      value: computeMetricValue(metric, snap),
    }));
  }

  async getDemographicsData(tenantId: string, userId: string): Promise<DemographicsData> {
    const account = await this.repos.instagram.findAccountByTenantId(tenantId);
    if (!account) throw new AccountNotConnectedError();

    const cacheKey = `demographics:${account.id}`;
    const cached = getCached<DemographicsData>(cacheKey);
    if (cached) return cached;

    const tokenRecord = await this.repos.instagram.findAccountWithToken(account.id);
    if (!tokenRecord?.tokenEncrypted) throw new AccountNotConnectedError();

    const token = decryptToken(tokenRecord.tokenEncrypted);
    const client = new InstagramClient(token);

    const [ageResults, genderResults, countryResults, cityResults] = await Promise.all([
      client.getDemographics(tokenRecord.igUserId, 'age'),
      client.getDemographics(tokenRecord.igUserId, 'gender'),
      client.getDemographics(tokenRecord.igUserId, 'country'),
      client.getDemographics(tokenRecord.igUserId, 'city'),
    ]);

    const followersTotal = account.followersCount ?? 0;

    const toItems = (results: Array<{ dimension_values: string[]; value: number }>) => {
      const total = results.reduce((s, r) => s + r.value, 0);
      return results
        .map((r) => ({
          label: r.dimension_values[0] ?? '',
          value: r.value,
          percentage: total > 0 ? Math.round((r.value / total) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.value - a.value);
    };

    const age = toItems(ageResults);
    const gender = toItems(genderResults);
    const countries = toItems(countryResults);
    const cities = toItems(cityResults);

    const totalFollowersWithData = ageResults.reduce((s, r) => s + r.value, 0);
    const coveragePercent =
      followersTotal > 0
        ? Math.round((totalFollowersWithData / followersTotal) * 1000) / 10
        : 0;

    const result: DemographicsData = {
      age,
      gender,
      countries,
      cities,
      totalFollowersWithData,
      coveragePercent,
      followersTotal,
    };

    setCache(cacheKey, result, 3_600_000);
    return result;
  }

  async getMediaDetail(tenantId: string, userId: string, mediaId: string): Promise<MediaWithMetrics> {
    const account = await this.repos.instagram.findAccountByTenantId(tenantId);
    if (!account) throw new AccountNotConnectedError();

    const media = await this.repos.instagram.findMediaById(mediaId);
    if (!media) throw new NotFoundError('Media', mediaId);
    return media;
  }

  async listMedia(
    tenantId: string,
    userId: string,
    params: { page?: number; pageSize?: number; mediaProductType?: string },
  ): Promise<PaginatedMedia> {
    const account = await this.repos.instagram.findAccountByTenantId(tenantId);
    if (!account) throw new AccountNotConnectedError();
    return this.repos.instagram.listMedia(account.id, params);
  }

  async getMediaPlaybackUrl(
    tenantId: string,
    userId: string,
    mediaId: string,
  ): Promise<string | null> {
    const account = await this.repos.instagram.findAccountByTenantId(tenantId);
    if (!account) throw new AccountNotConnectedError();

    const media = await this.repos.instagram.findMediaById(mediaId);
    if (!media || media.accountId !== account.id) throw new NotFoundError('Media', mediaId);

    const tokenRecord = await this.repos.instagram.findAccountWithToken(account.id);
    if (!tokenRecord?.tokenEncrypted) throw new AccountNotConnectedError();

    const token = decryptToken(tokenRecord.tokenEncrypted);
    const client = new InstagramClient(token);
    return client.getMediaUrl(media.igMediaId);
  }
}

function computeMetricValue(
  metric: string,
  snap: {
    followerCount: number | null;
    likes: number;
    comments: number;
    saves: number;
    shares: number;
    impressions: number;
    reach: number;
    profileViews: number;
  },
): number {
  switch (metric) {
    case 'followers':
      return snap.followerCount ?? 0;
    case 'engagement': {
      if (snap.impressions <= 0) return 0;
      const rate =
        ((snap.likes + snap.comments + snap.saves + snap.shares) / snap.impressions) * 100;
      return Math.round(rate * 100) / 100;
    }
    case 'reach':
      return snap.reach;
    case 'impressions':
      return snap.impressions;
    case 'profileViews':
      return snap.profileViews;
    default:
      return 0;
  }
}
