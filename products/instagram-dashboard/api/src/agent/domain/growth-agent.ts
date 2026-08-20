// Growth Agent domain types — pure TypeScript, no runtime code

export interface ToolCallResult { name: string; result: unknown }

export interface ToolCall { name: string; arguments: Record<string, unknown>; result?: unknown }

export interface DashboardContext {
  followersCount: number;
  mediaCount: number;
  recentPostCount: number;
  avgEngagementRate: number;
  topFormat: string;
}

export interface PostSummary {
  mediaId: string;
  mediaType: string;
  caption: string | null;
  postedAt: string;
  saves: number;
  shares: number;
  reach: number;
  engagementRate: number;
}

export interface FormatStats {
  format: string;
  avgEngagementRate: number;
  avgReach: number;
  avgSaves: number;
  avgShares: number;
  count: number;
}

export interface HeatmapData {
  dayOfWeek: number;
  hour: number;
  avgSavesShares: number;
}

export interface SuggestionOutcomeResult {
  id: string;
  category: string;
  content: string;
  outcome: string | null;
  createdAt: Date;
}
