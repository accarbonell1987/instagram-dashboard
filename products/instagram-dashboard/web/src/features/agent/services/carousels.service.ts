'use client'

import { getHubToken } from '@/features/shared/lib/hub-token'
import { apiFetch, API_BASE, InstagramApiError } from '@/features/shared/services/instagram-api'
import type {
  Carousel,
  CarouselSlide,
  CreateCarouselResult,
  CreateUploadCarouselResult,
  GeneratedSlide,
  PaginatedCarousels,
  PublishCarouselResult,
  UploadSlideInput,
} from '@/features/shared/types/instagram.types'

// Carousels: generating them, editing slides, publishing.
// Split out of a 538-line `instagram.service.ts` that answered for every
// screen at once; a change to carousels meant opening the file the dashboard
// imports too.

// ── Carousel ──

export async function listCarousels(page = 1, limit = 20): Promise<PaginatedCarousels> {
  const result = await apiFetch<{ success: true; data: PaginatedCarousels }>(
    `/api/carousels?page=${String(page)}&limit=${String(limit)}`,
  )
  return result.data
}

export async function getCarousel(id: string): Promise<Carousel> {
  const result = await apiFetch<{ success: true; data: Carousel }>(`/api/carousels/${encodeURIComponent(id)}`);
  return result.data;
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

export async function deleteCarousel(id: string): Promise<void> {
  await apiFetch<{ success: true; data: unknown }>(
    `/api/carousels/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
}

export async function publishCarousel(
  carouselId: string,
  caption?: string,
): Promise<PublishCarouselResult> {
  const url = `${API_BASE}/api/carousels/${encodeURIComponent(carouselId)}/publish`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getHubToken()
  if (token !== null) {
    headers['Authorization'] = `Bearer ${token}`
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
      body?.error.code ?? 'UNKNOWN',
      body?.error.message ?? response.statusText,
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

export async function reorderCarouselSlides(
  carouselId: string,
  order: { id: string; order: number }[],
): Promise<CarouselSlide[]> {
  const result = await apiFetch<{ success: true; data: { slides: CarouselSlide[] } }>(
    `/api/carousels/${encodeURIComponent(carouselId)}/reorder`,
    { method: 'PATCH', body: JSON.stringify({ order }) },
  );
  return result.data.slides;
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

export async function previewCarouselScript(topic: string): Promise<GeneratedSlide[]> {
  const result = await apiFetch<{ success: true; data: { slides: GeneratedSlide[] } }>(
    '/api/carousels/preview-script',
    { method: 'POST', body: JSON.stringify({ topic }) },
  )
  return result.data.slides
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
  const token = getHubToken();
  if (token !== null) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { method: 'PUT', headers, body: formData });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as {
      success: false;
      error: { code: string; message: string };
    } | null;
    throw new InstagramApiError(
      response.status,
      body?.error.code ?? 'UNKNOWN',
      body?.error.message ?? response.statusText,
    );
  }
}

// ── Usage / Quota ──
