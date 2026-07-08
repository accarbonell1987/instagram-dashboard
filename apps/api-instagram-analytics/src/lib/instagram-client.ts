import { config } from '../config.js';
import { InstagramAPIError, TokenExpiredError, RateLimitError, InsufficientScopeError } from '../errors.js';

const BASE_URL = config.IG_API_BASE_URL;

interface InstagramMediaItem {
  id: string;
  media_type: string;
  media_product_type?: string;
  permalink?: string;
  caption?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
  thumbnail_url?: string;
}

interface DemographicsBreakdownResult {
  dimension_values: string[];
  value: number;
}

interface DemographicsInsightResponse {
  data: Array<{
    name: string;
    period: string;
    total_value?: {
      breakdowns: Array<{
        dimension_types: string[];
        results: DemographicsBreakdownResult[];
      }>;
    };
  }>;
}

interface InstagramMediaListResponse {
  data: InstagramMediaItem[];
  paging?: {
    cursors?: { before?: string; after?: string };
    next?: string;
  };
}

interface InstagramInsightResponse {
  data: Array<{
    name: string;
    period: string;
    // Time-series shape (no metric_type): values[].value
    values?: Array<{ value: number; end_time?: string }>;
    // total_value shape (metric_type=total_value): total_value.value
    total_value?: { value: number };
  }>;
}

/**
 * Extracts the numeric value from an insight entry, handling BOTH response shapes:
 * - `total_value.value` (metric_type=total_value)
 * - `values[0].value` (time-series / lifetime)
 * Returns null when the metric came back empty (so callers can log it).
 */
export function extractInsightValue(insight: {
  values?: Array<{ value: number }>;
  total_value?: { value: number };
}): number | null {
  if (insight.total_value && typeof insight.total_value.value === 'number') {
    return insight.total_value.value;
  }
  const v = insight.values?.[0]?.value;
  return typeof v === 'number' ? v : null;
}

interface TokenExchangeResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user_id?: number;
}

interface InstagramMeResponse {
  id: string;
  username: string;
  account_type: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
  media_count?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonBody = Record<string, any>;

async function safeJson(response: Response): Promise<JsonBody> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.json() as Promise<JsonBody>;
  } catch {
    return {};
  }
}

async function igFetch<T>(
  path: string,
  token: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') ?? '3600', 10);
    throw new RateLimitError(retryAfter);
  }

  if (response.status === 401 || response.status === 403) {
    const body = await safeJson(response);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const errorCode = body['error']?.['code'];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const errorType: string | undefined = body['error']?.['type'];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const errorMessage: string | undefined = body['error']?.['message'];
    if (errorCode === 190) {
      throw new TokenExpiredError();
    }
    // OAuthException code 10 or 200 = insufficient permissions
    if (
      errorType === 'OAuthException' &&
      (errorCode === 10 || errorCode === 200)
    ) {
      throw new InsufficientScopeError();
    }
    throw new InstagramAPIError(
      `Instagram API auth error: ${errorMessage ?? 'Unknown'}`,
      body,
    );
  }

  if (!response.ok) {
    const body = await safeJson(response);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const errorMessage: string | undefined = body['error']?.['message'];
    throw new InstagramAPIError(
      `Instagram API error (${response.status}): ${errorMessage ?? 'Unknown'}`,
      body,
    );
  }

  return response.json() as Promise<T>;
}

async function igPost<T>(
  path: string,
  token: string,
  params: Record<string, string>,
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  const body = new URLSearchParams({ ...params, access_token: token });

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') ?? '3600', 10);
    throw new RateLimitError(retryAfter);
  }

  if (response.status === 401 || response.status === 403) {
    const responseBody = await safeJson(response);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const errorCode = responseBody['error']?.['code'];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const errorType: string | undefined = responseBody['error']?.['type'];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const errorMessage: string | undefined = responseBody['error']?.['message'];
    if (errorCode === 190) throw new TokenExpiredError();
    if (errorType === 'OAuthException' && (errorCode === 10 || errorCode === 200)) {
      throw new InsufficientScopeError();
    }
    throw new InstagramAPIError(`Instagram API auth error: ${errorMessage ?? 'Unknown'}`, responseBody);
  }

  if (!response.ok) {
    const responseBody = await safeJson(response);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const errorMessage: string | undefined = responseBody['error']?.['message'];
    throw new InstagramAPIError(
      `Instagram API error (${response.status}): ${errorMessage ?? 'Unknown'}`,
      responseBody,
    );
  }

  return response.json() as Promise<T>;
}

export class InstagramClient {
  constructor(private readonly accessToken: string) {}

  async getMedia(igUserId: string, limit = 50): Promise<InstagramMediaItem[]> {
    const response = await igFetch<InstagramMediaListResponse>(
      `/${igUserId}/media`,
      this.accessToken,
      {
        fields:
          'id,media_type,media_product_type,permalink,caption,timestamp,like_count,comments_count,thumbnail_url',
        limit: limit.toString(),
      },
    );
    return response.data;
  }

  async getMediaUrl(igMediaId: string): Promise<string | null> {
    const response = await igFetch<{ id: string; media_url?: string }>(
      `/${igMediaId}`,
      this.accessToken,
      { fields: 'id,media_url' },
    );
    return response.media_url ?? null;
  }

  async getDemographics(
    igUserId: string,
    breakdown: 'age' | 'city' | 'country' | 'gender',
  ): Promise<DemographicsBreakdownResult[]> {
    const response = await igFetch<DemographicsInsightResponse>(
      `/${igUserId}/insights`,
      this.accessToken,
      {
        metric: 'follower_demographics',
        period: 'lifetime',
        timeframe: 'last_30_days',
        metric_type: 'total_value',
        breakdown,
      },
    );
    return response.data[0]?.total_value?.breakdowns[0]?.results ?? [];
  }

  async getMediaInsights(
    igMediaId: string,
    metrics: string[],
  ): Promise<InstagramInsightResponse['data']> {
    // Media insights do NOT use metric_type (only account-level does).
    const response = await igFetch<InstagramInsightResponse>(
      `/${igMediaId}/insights`,
      this.accessToken,
      {
        metric: metrics.join(','),
      },
    );
    return response.data;
  }

  async getAccountInsights(
    igUserId: string,
    metrics: string[],
    period = 'day',
    metricType?: 'total_value',
  ): Promise<InstagramInsightResponse['data']> {
    const params: Record<string, string> = {
      metric: metrics.join(','),
      period,
    };
    // v25.0: most account metrics (reach, views, total_interactions, likes,
    // comments, saved, shares, accounts_engaged) REQUIRE metric_type=total_value.
    // Exception: follower_count must be requested WITHOUT metric_type (time-series).
    if (metricType) {
      params['metric_type'] = metricType;
    }
    const response = await igFetch<InstagramInsightResponse>(
      `/${igUserId}/insights`,
      this.accessToken,
      params,
    );
    return response.data;
  }

  // Instagram limits period=day with since/until to ~30 days per request.
  // Paginate in 30-day chunks to cover the full requested window.
  async getFollowerCountHistory(
    igUserId: string,
    sinceDate: Date,
    untilDate: Date,
  ): Promise<Array<{ date: Date; followerCount: number; reach: number }>> {
    const CHUNK_DAYS = 30;
    const results: Array<{ date: Date; followerCount: number; reach: number }> = [];

    let chunkStart = new Date(sinceDate);
    while (chunkStart < untilDate) {
      const chunkEnd = new Date(
        Math.min(chunkStart.getTime() + CHUNK_DAYS * 86_400_000, untilDate.getTime()),
      );

      const since = Math.floor(chunkStart.getTime() / 1000).toString();
      const until = Math.floor(chunkEnd.getTime() / 1000).toString();

      const response = await igFetch<InstagramInsightResponse>(
        `/${igUserId}/insights`,
        this.accessToken,
        { metric: 'follower_count,reach', period: 'day', since, until },
      );

      const byDate = new Map<string, { followerCount: number; reach: number }>();
      for (const insight of response.data) {
        if (!insight.values) continue;
        for (const v of insight.values) {
          if (!v.end_time || typeof v.value !== 'number') continue;
          const dateKey = v.end_time.slice(0, 10);
          const bucket = byDate.get(dateKey) ?? { followerCount: 0, reach: 0 };
          if (insight.name === 'follower_count') bucket.followerCount = v.value;
          if (insight.name === 'reach') bucket.reach = v.value;
          byDate.set(dateKey, bucket);
        }
      }

      for (const [dateKey, metrics] of byDate) {
        if (metrics.followerCount > 0) {
          results.push({ date: new Date(`${dateKey}T12:00:00Z`), ...metrics });
        }
      }

      chunkStart = new Date(chunkEnd.getTime() + 86_400_000);
      if (chunkStart < untilDate) {
        await new Promise<void>((resolve) => setTimeout(resolve, 200));
      }
    }

    return results.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  async getMe(): Promise<InstagramMeResponse> {
    return igFetch<InstagramMeResponse>('/me', this.accessToken, {
      fields: 'id,username,account_type,name,profile_picture_url,followers_count,media_count',
    });
  }

  // ── Content Publishing API ────────────────────────────────────────

  async createImageContainer(igUserId: string, imageUrl: string): Promise<{ id: string }> {
    return igPost<{ id: string }>(`/${igUserId}/media`, this.accessToken, {
      image_url: imageUrl,
      is_carousel_item: 'true',
      media_type: 'IMAGE',
    });
  }

  async createCarouselContainer(
    igUserId: string,
    children: string[],
    caption: string,
  ): Promise<{ id: string }> {
    return igPost<{ id: string }>(`/${igUserId}/media`, this.accessToken, {
      media_type: 'CAROUSEL',
      children: children.join(','),
      caption,
    });
  }

  async publishMedia(igUserId: string, creationId: string): Promise<{ id: string }> {
    return igPost<{ id: string }>(`/${igUserId}/media_publish`, this.accessToken, {
      creation_id: creationId,
    });
  }

  async getMediaPermalink(igMediaId: string): Promise<{ permalink: string }> {
    return igFetch<{ permalink: string }>(`/${igMediaId}`, this.accessToken, {
      fields: 'permalink',
    });
  }

  async getContainerStatus(containerId: string): Promise<{ status_code: string; status?: string }> {
    return igFetch<{ status_code: string; status?: string }>(
      `/${containerId}`,
      this.accessToken,
      { fields: 'status_code,status' },
    );
  }

  /**
   * Polls the container status until it is FINISHED (ready to publish) or
   * until it fails / times out. Instagram typically takes 5–30 seconds to
   * process carousel image containers after creation.
   *
   * @throws InstagramAPIError when the container enters ERROR/EXPIRED status
   * @throws InstagramAPIError when the timeout is exceeded
   */
  async waitForContainerReady(
    containerId: string,
    options: { intervalMs?: number; timeoutMs?: number } = {},
  ): Promise<void> {
    const intervalMs = options.intervalMs ?? 3_000
    const timeoutMs = options.timeoutMs ?? 90_000
    const deadline = Date.now() + timeoutMs

    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

    while (Date.now() < deadline) {
      const { status_code } = await this.getContainerStatus(containerId)

      if (status_code === 'FINISHED') return

      if (status_code === 'ERROR' || status_code === 'EXPIRED') {
        throw new InstagramAPIError(
          `Container ${containerId} entered status ${status_code} — cannot publish`,
        )
      }

      // IN_PROGRESS or unknown — keep waiting
      await sleep(intervalMs)
    }

    throw new InstagramAPIError(
      `Container ${containerId} did not finish processing within ${String(timeoutMs / 1000)}s`,
    )
  }

  static async exchangeCodeForToken(code: string): Promise<TokenExchangeResponse> {
    const url = new URL('https://api.instagram.com/oauth/access_token');
    const body = new URLSearchParams({
      client_id: config.IG_APP_ID,
      client_secret: config.IG_APP_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: config.IG_REDIRECT_URI,
      code,
    });

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const err = await safeJson(response);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const errMsg: string | undefined = err['error_message'];
      throw new InstagramAPIError(
        `Token exchange failed: ${errMsg ?? 'Unknown error'}`,
        err,
      );
    }

    return response.json() as Promise<TokenExchangeResponse>;
  }

  static async exchangeForLongLivedToken(
    shortLivedToken: string,
  ): Promise<TokenExchangeResponse> {
    const url = new URL('https://graph.instagram.com/access_token');
    url.searchParams.set('grant_type', 'ig_exchange_token');
    url.searchParams.set('client_secret', config.IG_APP_SECRET);
    url.searchParams.set('access_token', shortLivedToken);

    const response = await fetch(url.toString());

    if (!response.ok) {
      const err = await safeJson(response);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const errMsg: string | undefined = err['error_message'];
      throw new InstagramAPIError(
        `Long-lived token exchange failed: ${errMsg ?? 'Unknown'}`,
        err,
      );
    }

    return response.json() as Promise<TokenExchangeResponse>;
  }

  static async refreshToken(longLivedToken: string): Promise<TokenExchangeResponse> {
    const url = new URL('https://graph.instagram.com/refresh_access_token');
    url.searchParams.set('grant_type', 'ig_refresh_token');
    url.searchParams.set('access_token', longLivedToken);

    const response = await fetch(url.toString());

    if (!response.ok) {
      const err = await safeJson(response);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const errMsg: string | undefined = err['error_message'];
      throw new InstagramAPIError(
        `Token refresh failed: ${errMsg ?? 'Unknown'}`,
        err,
      );
    }

    return response.json() as Promise<TokenExchangeResponse>;
  }
}
