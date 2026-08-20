export interface InstagramMedia {
  id: string;
  accountId: string;
  igMediaId: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  mediaProductType: 'FEED' | 'REELS' | 'STORY' | null;
  permalink: string | null;
  caption: string | null;
  thumbnailUrl: string | null;
  postedAt: Date;
}

export interface MediaMetrics {
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  reach: number;
  impressions: number;
  totalInteractions: number;
  videoViews: number | null;
  avgWatchTime: number | null;      // ms from ig_reels_avg_watch_time
  videoViewTotalTime: number | null; // ms from ig_reels_video_view_total_time
  syncedAt: Date;
}

export interface MediaWithMetrics extends InstagramMedia {
  metrics: MediaMetrics | null;
}

export interface PaginatedMedia {
  data: MediaWithMetrics[];
  total: number;
  page: number;
  pageSize: number;
}
