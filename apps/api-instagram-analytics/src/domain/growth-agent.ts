// Growth Agent domain types — pure TypeScript, no runtime code

export type ToolCallResult = { name: string; result: unknown }

export type ToolCall = { name: string; arguments: Record<string, unknown>; result?: unknown }

export type DashboardContext = {
  followersCount: number;
  mediaCount: number;
  recentPostCount: number;
  avgEngagementRate: number;
  topFormat: string;
}

export type PostSummary = {
  mediaId: string;
  mediaType: string;
  caption: string | null;
  postedAt: string;
  saves: number;
  shares: number;
  reach: number;
  engagementRate: number;
}

export type FormatStats = {
  format: string;
  avgEngagementRate: number;
  avgReach: number;
  avgSaves: number;
  avgShares: number;
  count: number;
}

export type HeatmapData = {
  dayOfWeek: number;
  hour: number;
  avgSavesShares: number;
}

export type SuggestionOutcomeResult = {
  id: string;
  category: string;
  content: string;
  outcome: string | null;
  createdAt: Date;
}
