'use client'

import { apiFetch } from '@/features/shared/services/instagram-api'
import type {
  MediaDetail,
  PaginatedMediaList,
  PaginatedReels,
  PublicationFilter,
  ReelMedia,
} from '@/features/shared/types/instagram.types'

// Published posts and reels.
// Split out of a 538-line `instagram.service.ts` that answered for every
// screen at once; a change to carousels meant opening the file the dashboard
// imports too.

export async function getMediaList(page = 1, pageSize = 10): Promise<PaginatedMediaList> {
  const result = await apiFetch<{
    success: true;
    data: PaginatedMediaList;
  }>(`/api/media?page=${String(page)}&pageSize=${String(pageSize)}`);
  return result.data;
}

// ── Media ──

export async function getPostDetail(postId: string): Promise<MediaDetail> {
  const result = await apiFetch<{ success: true; data: MediaDetail }>(`/api/media/${postId}`);
  return result.data;
}

export async function getPublications(
  filter: PublicationFilter,
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

export async function getReels(page = 1, pageSize = 20): Promise<PaginatedReels> {
  const result = await apiFetch<{ success: true; data: PaginatedReels }>(
    `/api/media?productType=REELS&page=${String(page)}&pageSize=${String(pageSize)}`,
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
