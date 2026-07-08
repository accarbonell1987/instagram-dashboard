export type InstagramPeriod = '7d' | '30d' | '90d'
export type GrowthPeriod = 'all' | '1y' | '90d' | '30d' | '7d'

export type PostType = 'image' | 'video' | 'carousel' | 'reel'

export type MetricTrend = 'up' | 'down' | 'stable'

export interface InstagramProfile {
  username: string
  fullName: string
  avatarUrl: string
  bio: string
  website: string | undefined
  isVerified: boolean
  isBusiness: boolean
  followersCount: number
  followingCount: number
  postsCount: number
}

export interface OverviewStats {
  followers: MetricValue
  engagement: MetricValue
  reach: MetricValue
  impressions: MetricValue
  profileViews: MetricValue
}

export interface MetricValue {
  current: number
  previous: number
  trend: MetricTrend
  percentageChange: number
}

// ── North-star scorecards ──

export interface NorthStarMetric {
  value: number
  previousValue: number
  delta: number
  deltaPercent: number | null
}

export interface NorthStarMetrics {
  reachTotal: NorthStarMetric
  shareRate: NorthStarMetric
  saveRate: NorthStarMetric
  followerGrowth: NorthStarMetric
}

// ── Demographics ──

export interface DemographicItem {
  label: string
  value: number
  percentage: number
}

export interface DemographicsData {
  age: DemographicItem[]
  gender: DemographicItem[]
  countries: DemographicItem[]
  cities: DemographicItem[]
  totalFollowersWithData: number
  coveragePercent: number
  followersTotal: number
}

// ── Engagement ──

export interface EngagementDataPoint {
  date: string
  likes: number
  comments: number
  shares: number
  saves: number
}

export interface AudienceDemographics {
  ageRanges: AgeRange[]
  topCities: LocationItem[]
  topCountries: LocationItem[]
  genderSplit: GenderSplit
}

export interface AgeRange {
  range: string
  percentage: number
}

export interface LocationItem {
  name: string
  percentage: number
}

export interface GenderSplit {
  male: number
  female: number
  other: number
}

export interface InstagramPost {
  id: string
  shortcode: string
  type: PostType
  caption: string
  thumbnailUrl: string
  permalink: string
  timestamp: string
  metrics: PostMetrics
  isTopPerformer: boolean
}

export interface PostMetrics {
  likes: number
  comments: number
  shares: number
  saves: number
  impressions: number
  reach: number
  engagementRate: number
}

// ── Reel media (from /api/media?productType=REELS) ──

export interface ReelMedia {
  id: string
  accountId: string
  igMediaId: string
  mediaType: string
  mediaProductType: string | null
  permalink: string | null
  caption: string | null
  thumbnailUrl: string | null
  postedAt: string
  metrics: {
    likes: number
    comments: number
    saves: number
    shares: number
    reach: number
    impressions: number
    totalInteractions: number
    videoViews: number | null
    avgWatchTime: number | null
    videoViewTotalTime: number | null
    syncedAt: string
  } | null
}

export interface PaginatedReels {
  data: ReelMedia[]
  total: number
  page: number
  pageSize: number
}

export interface DashboardData {
  profile: InstagramProfile
  overview: OverviewStats
  engagementHistory: EngagementDataPoint[]
  topPosts: InstagramPost[]
  recentPosts: InstagramPost[]
  audience: AudienceDemographics
  period: InstagramPeriod
  lastUpdated: string
}

export interface DashboardQueryParams {
  period?: InstagramPeriod
}

// ── Backend contract types (api-instagram-analytics) ──

export interface ConnectionStatus {
  connected: boolean
  username?: string
  accountType?: string
  tokenExpiresAt?: string
}

export interface SyncState {
  status: 'idle' | 'syncing' | 'paused' | 'error'
  lastSyncAt: string | null
  mediaCount: number
  nextSyncAvailableAt: string | null
}

export interface InsightResult {
  insight: string
  generatedAt: string
}

export interface FormatBreakdown {
  format: string
  postCount: number
  avgSaves: number
  avgShares: number
  avgLikes: number
  avgComments: number
  avgReach: number
}

// ── Prescriptive findings ──

export interface ContentFinding {
  type: 'format' | 'posting_time' | 'top_commonality' | 'caption_length'
  pattern: string
  keyNumber: string
  action: string
  confidence: 'tentative' | 'consistent'
  postCount: number
}

export interface HeatmapCell {
  day: string
  dayIndex: number
  slot: string
  slotIndex: number
  totalSavesShares: number
  postCount: number
}

export interface TopPost {
  id: string
  igMediaId: string
  mediaType: string
  permalink: string | null
  caption: string | null
  thumbnailUrl: string | null
  postedAt: string
  saves: number
  shares: number
  likes: number
  comments: number
  reach: number
  totalEngagement: number
}

export interface DashboardDataV2 extends DashboardData {
  ranking: TopPost[]
  formatBreakdown: FormatBreakdown[]
  heatmap: HeatmapCell[]
  insight: InsightResult
  northStar?: NorthStarMetrics
}

export interface MediaDetail extends InstagramPost {
  metrics: PostMetrics
}

export interface PaginatedMediaList {
  data: MediaDetail[]
  total: number
  page: number
  pageSize: number
}

export interface SyncTriggerResult {
  syncId: string
  status: 'started' | 'already_running' | 'rate_limited'
}

// ── Growth Agent types ──

export type MessageRole = 'user' | 'assistant'
export type SuggestionCategory = 'caption' | 'format' | 'posting_time' | 'hook' | 'hashtags' | 'content_idea'
export type SuggestionStatus = 'pending' | 'used' | 'dismissed'
export type SuggestionOutcome = 'exceeded' | 'met' | 'below'

export interface ChatMessage {
  id: string
  sessionId: string
  role: MessageRole
  content: string
  createdAt: string
}

export interface ContentSuggestion {
  id: string
  batchId?: string | null
  category: SuggestionCategory
  content: string
  status: SuggestionStatus
  outcome: SuggestionOutcome | null
  createdAt: string
}

export interface SuggestionBatch {
  id: string
  userMessage: string
  createdAt: string
  suggestions: ContentSuggestion[]
}

export interface SuggestionBatchesResponse {
  batches: SuggestionBatch[]
  total: number
  page: number
  limit: number
}

export interface ChatResponse {
  reply: string
  sessionId: string
  suggestions: ContentSuggestion[]
  toolCallsTrace: Array<{ name: string; arguments: Record<string, unknown> }>
}

export interface ClearHistoryResponse {
  deletedCount: number
}

export interface DeleteMessageResponse {
  deleted: boolean
}

// ── Agent Config ──

export interface ImageGenConfig {
  basePrompt?: string
  hookPrompt?: string
  developmentPrompt?: string
  ctaPrompt?: string
  t2iModel?: string
  i2iModel?: string
}

export interface AgentLimits {
  slideText?: number
  visualPrompt?: number
}

export interface AgentConfig {
  niche: string;
  tags: string[];
  customPrompt?: string;
  imageGen?: ImageGenConfig;
  limits?: AgentLimits;
}

export interface AgentSettingsResponse {
  agentConfig: AgentConfig | null
  hasFalApiKey: boolean
}

// ── Carousel ──

export type CarouselStatus = 'pending' | 'generating_script' | 'generating_images' | 'ready' | 'failed'
export type SlideStatus = 'pending' | 'generating' | 'ready' | 'failed'
export type SlideRole = 'hook' | 'development' | 'cta' | 'default'
export type PublishStatus = 'unpublished' | 'published' | 'failed'
export type ImageMode = 'ai_gen' | 'uploaded' | 'img2img'
export type CarouselType = 'ai_gen' | 'upload'

export interface CarouselSlide {
  id: string
  carouselId: string
  order: number
  role: SlideRole
  text: string
  visualPrompt: string
  imageUrl: string | null
  uploadedImageUrl: string | null
  imageMode: ImageMode
  status: SlideStatus
  createdAt: string
  updatedAt: string
}

export interface Carousel {
  id: string
  tenantId: string
  accountId: string | null
  suggestionId: string | null
  topic: string
  status: CarouselStatus
  errorMessage: string | null
  caption: string | null
  carouselType: CarouselType
  publishStatus: PublishStatus
  publishedAt: string | null
  igMediaId: string | null
  igPermalink: string | null
  createdAt: string
  updatedAt: string
  slides: CarouselSlide[]
}

export interface GeneratedSlide {
  order: number
  role: SlideRole
  text: string
  visualPrompt: string
}

export interface UploadSlideInput {
  order: number
  role: SlideRole
  text: string
  imageMode: 'uploaded' | 'img2img'
  visualPrompt?: string
}

export interface CreateCarouselResult {
  id: string
  status: string
}

export interface CreateUploadCarouselResult {
  id: string
  status: string
  slides: Array<{ id: string; order: number; status: string }>
}

export interface PublishCarouselResult {
  igMediaId: string
  permalink: string
}

export interface PaginatedCarousels {
  carousels: Carousel[]
  total: number
  page: number
  limit: number
}

// ── Publication filter ──

export type PublicationFilter = 'all' | 'image' | 'carousel' | 'reel'

// ── Growth Types ──

export interface GrowthDataPoint {
  date: string
  value: number
}

export type GrowthMetric = 'followers' | 'engagement' | 'reach' | 'impressions' | 'profileViews'

// ── Usage / Quota Types ──

export interface QuotaEntry {
  used: number
  limit: number
  period: string
  resetsAt: string
}

export interface UsageResponse {
  quotas: {
    deepseek_tokens: QuotaEntry
    fal_images: QuotaEntry
  }
  periodStart: string
  periodEnd: string
}
