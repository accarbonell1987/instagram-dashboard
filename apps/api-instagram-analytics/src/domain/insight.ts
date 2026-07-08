export interface AccountInsight {
  period: string;
  syncedAt: Date;
  impressions: number;
  reach: number;
  profileViews: number;
  followerCount: number | null;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
}

/** A single historical snapshot of account-level metrics from a sync. */
export interface InsightSnapshot {
  syncedAt: Date;
  followerCount: number | null;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  impressions: number;
  reach: number;
  profileViews: number;
}

export interface FormatBreakdown {
  format: string;
  postCount: number;
  avgSaves: number;
  avgShares: number;
  avgLikes: number;
  avgComments: number;
  avgReach: number;
}

// ─── Prescriptive findings ────────────────────────────────────────────────────

export interface ContentFinding {
  type: 'format' | 'posting_time' | 'top_commonality' | 'caption_length';
  /** Full sentence describing the pattern. Contains keyNumber literally. */
  pattern: string;
  /** The key metric to display prominently (e.g. "2,3×", "67%"). */
  keyNumber: string;
  /** Concrete, hypothesis-framed action the creator can try. */
  action: string;
  /** Confidence based on sample size. */
  confidence: 'tentative' | 'consistent';
  /** Number of posts analyzed for this finding. */
  postCount: number;
}

export interface HeatmapCell {
  day: string;
  dayIndex: number;
  slot: string;
  slotIndex: number;
  totalSavesShares: number;
  postCount: number;
}

export interface InsightResult {
  insight: string;
  generatedAt: string;
}

export interface NorthStarMetric {
  value: number;
  previousValue: number;
  delta: number;
  deltaPercent: number | null;
}

export interface NorthStarMetrics {
  reachTotal: NorthStarMetric;
  shareRate: NorthStarMetric;
  saveRate: NorthStarMetric;
  followerGrowth: NorthStarMetric;
}

export interface DemographicItem {
  label: string;
  value: number;
  percentage: number;
}

export interface DemographicsData {
  age: DemographicItem[];
  gender: DemographicItem[];
  countries: DemographicItem[];
  cities: DemographicItem[];
  totalFollowersWithData: number;
  coveragePercent: number;
  followersTotal: number;
}

export interface DashboardData {
  period: string;
  account: {
    username: string;
    displayName: string | null;
    profilePictureUrl: string | null;
    accountType: string;
    followerCount: number | null;
    mediaCount: number | null;
  };
  overview: {
    totalPosts: number;
    totalSaves: number;
    totalShares: number;
    totalImpressions: number;
    totalReach: number;
  };
  northStar?: NorthStarMetrics;
  ranking: Array<{
    id: string;
    igMediaId: string;
    mediaType: string;
    permalink: string | null;
    caption: string | null;
    thumbnailUrl: string | null;
    postedAt: string;
    saves: number;
    shares: number;
    likes: number;
    comments: number;
    reach: number;
    totalEngagement: number;
  }>;
  formatBreakdown: FormatBreakdown[];
  heatmap: HeatmapCell[];
  insight: InsightResult;
  findings?: ContentFinding[];
  lastUpdated?: string;
}
