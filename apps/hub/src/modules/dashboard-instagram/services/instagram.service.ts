'use client';

import type {
  ConnectionStatus,
  DashboardData,
  DashboardQueryParams,
  InsightResult,
  MediaDetail,
  PaginatedMediaList,
  PaginatedReels,
  ReelMedia,
  DemographicsData,
  SyncState,
  SyncTriggerResult,
  ChatMessage,
  ContentSuggestion,
  ChatResponse,
  ClearHistoryResponse,
  DeleteMessageResponse,
  GrowthDataPoint,
  GrowthMetric,
  GrowthPeriod,
  AgentConfig,
  AgentSettingsResponse,
  Carousel,
  CarouselSlide,
  GeneratedSlide,
  UploadSlideInput,
  CreateCarouselResult,
  CreateUploadCarouselResult,
  PublishCarouselResult,
  PaginatedCarousels,
  UsageResponse,
} from '../types/instagram.types';
import type { InstagramPeriod } from '../types/instagram.types';

import { getAccessToken, isExpired } from '@/modules/iam/identity/session/token';

// ── API base URL ──
const API_BASE = process.env['NEXT_PUBLIC_INSTAGRAM_API_URL'] ?? 'http://localhost:3003'

/**
 * Resolve a carousel slide imageUrl for display in the browser.
 * New images are stored as relative paths (/carousels/...). Old images may be
 * stored as absolute URLs (ngrok, etc.) — strip their origin and rebase to the
 * local API server so they always load correctly in development.
 */
export function resolveImageUrl(imageUrl: string): string {
  if (imageUrl.startsWith('/')) return `${API_BASE}${imageUrl}`
  try {
    const url = new URL(imageUrl)
    return `${API_BASE}${url.pathname}`
  } catch {
    return imageUrl
  }
}

export class InstagramApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'InstagramApiError'
  }
}

// ── Thin fetch wrapper ──
// Targets the Instagram API origin. Injects the Hub JWT (from getAccessToken())
// so the backend can verify tenant context via api-iam JWKS.
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };

  const token = getAccessToken();
  if (token !== null && !isExpired(token)) {
    headers['Authorization'] = `Bearer ${token.raw}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Access token expired — the instagram service doesn't auto-refresh tokens.
    // Redirect to login so the user gets a fresh session.
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Session expired. Please log in again.');
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Instagram API error ${response.status}: ${text || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

// ── Auth ──

export async function disconnectAccount(): Promise<void> {
  await apiFetch<{ success: true; data: unknown }>('/api/auth/instagram/disconnect', {
    method: 'POST',
  });
}

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  const result = await apiFetch<{ success: true; data: ConnectionStatus }>(
    '/api/auth/instagram/status'
  );
  return result.data;
}

/**
 * Fetches the Instagram OAuth authorization URL from the backend.
 * The backend builds the URL with the tenant context encoded in the state param.
 * The frontend then redirects the browser to Instagram.
 */
export async function getOAuthUrl(): Promise<string> {
  const result = await apiFetch<{ success: true; data: { url: string } }>(
    '/api/auth/instagram/authorize'
  );
  return result.data.url;
}

// ── Sync ──

export async function triggerSync(): Promise<SyncTriggerResult> {
  const result = await apiFetch<{ success: true; data: SyncTriggerResult }>('/api/sync/trigger', {
    method: 'POST',
  });
  return result.data;
}

export async function getSyncStatus(): Promise<SyncState> {
  const result = await apiFetch<{ success: true; data: SyncState }>('/api/sync/status');
  return result.data;
}

// ── Dashboard ──

export async function getDashboardData(params?: DashboardQueryParams): Promise<DashboardData> {
  const query = params?.period ? `?period=${params.period}` : '';
  const result = await apiFetch<{ success: true; data: DashboardData }>(`/api/dashboard${query}`);
  return result.data;
}

export async function getInsight(): Promise<InsightResult> {
  const result = await apiFetch<{ success: true; data: InsightResult }>('/api/dashboard/insight');
  return result.data;
}

// ── Media ──

export async function getPostDetail(postId: string): Promise<MediaDetail> {
  const result = await apiFetch<{ success: true; data: MediaDetail }>(`/api/media/${postId}`);
  return result.data;
}

export async function getMediaList(page = 1, pageSize = 10): Promise<PaginatedMediaList> {
  const result = await apiFetch<{
    success: true;
    data: PaginatedMediaList;
  }>(`/api/media?page=${page}&pageSize=${pageSize}`);
  return result.data;
}

export async function getReels(page = 1, pageSize = 20): Promise<PaginatedReels> {
  const result = await apiFetch<{ success: true; data: PaginatedReels }>(
    `/api/media?productType=REELS&page=${page}&pageSize=${pageSize}`,
  );
  return result.data;
}

export async function getPublications(
  filter: import('../types/instagram.types').PublicationFilter,
  page = 1,
  pageSize = 50,
): Promise<PaginatedReels> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filter === 'image') params.set('type', 'IMAGE');
  else if (filter === 'carousel') params.set('type', 'CAROUSEL_ALBUM');
  else if (filter === 'reel') params.set('productType', 'REELS');
  const result = await apiFetch<{ success: true; data: PaginatedReels }>(
    `/api/media?${params.toString()}`,
  );
  return result.data;
}

export async function getReelDetail(mediaId: string): Promise<ReelMedia> {
  const result = await apiFetch<{ success: true; data: ReelMedia }>(`/api/media/${mediaId}`);
  return result.data;
}

export async function getReelPlaybackUrl(mediaId: string): Promise<string | null> {
  const result = await apiFetch<{ success: true; data: { mediaUrl: string | null } }>(
    `/api/media/${mediaId}/playback`,
  );
  return result.data.mediaUrl;
}

// ── Demographics ──

export async function getDemographics(): Promise<DemographicsData> {
  const result = await apiFetch<{ success: true; data: DemographicsData }>(
    '/api/dashboard/demographics',
  );
  return result.data;
}

// ── Growth Agent ──

export async function sendChatMessage(
  message: string,
  sessionId?: string,
  history?: Array<{ role: string; content: string }>,
): Promise<ChatResponse> {
  const result = await apiFetch<{ success: true; data: ChatResponse }>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: sessionId ?? crypto.randomUUID(),
      message,
      history: history ?? [],
    }),
  });
  return result.data;
}

export async function getChatHistory(sessionId: string): Promise<ChatMessage[]> {
  const result = await apiFetch<{ success: true; data: ChatMessage[] }>(
    `/api/chat/history?sessionId=${encodeURIComponent(sessionId)}`,
  );
  return result.data;
}

export async function getSuggestions(status?: string): Promise<ContentSuggestion[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const result = await apiFetch<{ success: true; data: ContentSuggestion[] }>(
    `/api/suggestions${query}`,
  );
  return result.data;
}

export async function getSuggestionBatches(
  page = 1,
  limit = 10,
): Promise<import('../types/instagram.types').SuggestionBatchesResponse> {
  const result = await apiFetch<{
    success: true;
    data: import('../types/instagram.types').SuggestionBatchesResponse;
  }>(`/api/suggestions/batches?page=${page}&limit=${limit}`);
  return result.data;
}

export async function markSuggestionUsed(id: string, linkedMediaId?: string): Promise<void> {
  // Only send linkedMediaId when it's a non-empty value — backend validates it as UUID.
  const body = linkedMediaId ? { linkedMediaId } : {};
  await apiFetch<{ success: true; data: unknown }>(
    `/api/suggestions/${encodeURIComponent(id)}/mark-used`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}

export async function dismissSuggestion(id: string): Promise<void> {
  await apiFetch<{ success: true; data: unknown }>(
    `/api/suggestions/${encodeURIComponent(id)}/dismiss`,
    {
      method: 'POST',
    },
  );
}

export async function deleteChatMessage(id: string): Promise<DeleteMessageResponse> {
  const result = await apiFetch<{ success: true; data: DeleteMessageResponse }>(
    `/api/chat/messages/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
  return result.data;
}

export async function clearChatHistory(sessionId: string): Promise<ClearHistoryResponse> {
  const result = await apiFetch<{ success: true; data: ClearHistoryResponse }>(
    `/api/chat/history?sessionId=${encodeURIComponent(sessionId)}`,
    { method: 'DELETE' },
  );
  return result.data;
}

// ── Growth ──

export async function backfillFollowerHistory(): Promise<{ inserted: number }> {
  const result = await apiFetch<{ success: true; data: { inserted: number } }>(
    '/api/sync/backfill',
    { method: 'POST' },
  );
  return result.data;
}

export async function getGrowthData(
  metric: GrowthMetric,
  period: GrowthPeriod,
): Promise<GrowthDataPoint[]> {
  const result = await apiFetch<{ success: true; data: GrowthDataPoint[] }>(
    `/api/dashboard/growth?metric=${metric}&period=${period}`,
  );
  return result.data;
}

// ── Agent Config ──

export async function getAgentSettings(): Promise<AgentSettingsResponse> {
  const result = await apiFetch<{ success: true; data: AgentSettingsResponse }>(
    '/api/agent/settings',
  );
  return result.data;
}

export async function saveAgentSettings(
  config: AgentConfig,
  falApiKey?: string,
): Promise<void> {
  await apiFetch<{ success: true; data: unknown }>('/api/agent/settings', {
    method: 'PUT',
    body: JSON.stringify({
      ...config,
      ...(falApiKey !== undefined && { falApiKey }),
    }),
  });
}

// ── Carousel ──

export async function listCarousels(page = 1, limit = 20): Promise<PaginatedCarousels> {
  const result = await apiFetch<{ success: true; data: PaginatedCarousels }>(
    `/api/carousels?page=${page}&limit=${limit}`,
  )
  return result.data
}

export async function deleteCarousel(id: string): Promise<void> {
  await apiFetch<{ success: true; data: unknown }>(
    `/api/carousels/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
}

export async function generateContentSuggestion(prompt: string): Promise<ContentSuggestion> {
  const result = await apiFetch<{ success: true; data: ContentSuggestion }>(
    '/api/suggestions/generate',
    { method: 'POST', body: JSON.stringify({ prompt }) },
  )
  return result.data
}

export async function previewCarouselScript(topic: string): Promise<GeneratedSlide[]> {
  const result = await apiFetch<{ success: true; data: { slides: GeneratedSlide[] } }>(
    '/api/carousels/preview-script',
    { method: 'POST', body: JSON.stringify({ topic }) },
  )
  return result.data.slides
}

export async function createCarousel(
  topic: string,
  suggestionId?: string,
  slides?: GeneratedSlide[],
): Promise<CreateCarouselResult> {
  const result = await apiFetch<{ success: true; data: CreateCarouselResult }>('/api/carousels', {
    method: 'POST',
    body: JSON.stringify({
      topic,
      ...(suggestionId !== undefined && { suggestionId }),
      ...(slides !== undefined && { slides }),
    }),
  });
  return result.data;
}

export async function getCarousel(id: string): Promise<Carousel> {
  const result = await apiFetch<{ success: true; data: Carousel }>(`/api/carousels/${encodeURIComponent(id)}`);
  return result.data;
}

export async function updateCarouselSlide(
  carouselId: string,
  slideId: string,
  data: { text?: string; visualPrompt?: string },
): Promise<CarouselSlide> {
  const result = await apiFetch<{ success: true; data: CarouselSlide }>(
    `/api/carousels/${encodeURIComponent(carouselId)}/slides/${encodeURIComponent(slideId)}`,
    { method: 'PATCH', body: JSON.stringify(data) },
  );
  return result.data;
}

export async function regenerateCarouselSlide(
  carouselId: string,
  slideId: string,
): Promise<void> {
  await apiFetch<{ success: true; data: unknown }>(
    `/api/carousels/${encodeURIComponent(carouselId)}/slides/${encodeURIComponent(slideId)}/regenerate`,
    { method: 'POST' },
  );
}

export async function reorderCarouselSlides(
  carouselId: string,
  order: Array<{ id: string; order: number }>,
): Promise<CarouselSlide[]> {
  const result = await apiFetch<{ success: true; data: { slides: CarouselSlide[] } }>(
    `/api/carousels/${encodeURIComponent(carouselId)}/reorder`,
    { method: 'PATCH', body: JSON.stringify({ order }) },
  );
  return result.data.slides;
}

export async function publishCarousel(
  carouselId: string,
  caption?: string,
): Promise<PublishCarouselResult> {
  const url = `${API_BASE}/api/carousels/${encodeURIComponent(carouselId)}/publish`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getAccessToken()
  if (token !== null && !isExpired(token)) {
    headers['Authorization'] = `Bearer ${token.raw}`
  }
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(caption !== undefined ? { caption } : {}),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as {
      success: false
      error: { code: string; message: string }
    } | null
    throw new InstagramApiError(
      response.status,
      body?.error?.code ?? 'UNKNOWN',
      body?.error?.message ?? response.statusText,
    )
  }
  const result = await response.json() as { success: true; data: PublishCarouselResult }
  return result.data
}

export async function regenerateCarousel(
  carouselId: string,
  topic?: string,
): Promise<Pick<Carousel, 'id' | 'status'>> {
  const result = await apiFetch<{ success: true; data: Pick<Carousel, 'id' | 'status'> }>(
    `/api/carousels/${encodeURIComponent(carouselId)}/regenerate`,
    {
      method: 'POST',
      body: JSON.stringify(topic !== undefined ? { topic } : {}),
    },
  );
  return result.data;
}

export async function createUploadCarousel(
  topic: string,
  slides: UploadSlideInput[],
  caption?: string,
): Promise<CreateUploadCarouselResult> {
  const result = await apiFetch<{ success: true; data: CreateUploadCarouselResult }>('/api/carousels/upload', {
    method: 'POST',
    body: JSON.stringify({
      topic,
      slides,
      ...(caption !== undefined && { caption }),
    }),
  });
  return result.data;
}

export async function uploadSlideImage(
  carouselId: string,
  slideId: string,
  file: File,
): Promise<void> {
  const formData = new FormData();
  formData.append('image', file);

  const url = `${API_BASE}/api/carousels/${encodeURIComponent(carouselId)}/slides/${encodeURIComponent(slideId)}/image`;
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token !== null && !isExpired(token)) {
    headers['Authorization'] = `Bearer ${token.raw}`;
  }

  const response = await fetch(url, { method: 'PUT', headers, body: formData });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as {
      success: false;
      error: { code: string; message: string };
    } | null;
    throw new InstagramApiError(
      response.status,
      body?.error?.code ?? 'UNKNOWN',
      body?.error?.message ?? response.statusText,
    );
  }
}

// ── Usage / Quota ──

export async function getUsage(): Promise<UsageResponse> {
  const result = await apiFetch<{ success: true; data: UsageResponse }>('/api/agent/usage');
  return result.data;
}
