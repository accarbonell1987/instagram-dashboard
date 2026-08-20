'use client'

import { apiFetch } from '@/features/shared/services/instagram-api'
import type {
  ContentSuggestion,
  SuggestionBatchesResponse,
} from '@/features/shared/types/instagram.types'

// Content suggestions and what happens to them.
// Split out of a 538-line `instagram.service.ts` that answered for every
// screen at once; a change to carousels meant opening the file the dashboard
// imports too.

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
): Promise<SuggestionBatchesResponse> {
  const result = await apiFetch<{
    success: true;
    data: SuggestionBatchesResponse;
  }>(`/api/suggestions/batches?page=${String(page)}&limit=${String(limit)}`);
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

export async function generateContentSuggestion(prompt: string): Promise<ContentSuggestion> {
  const result = await apiFetch<{ success: true; data: ContentSuggestion }>(
    '/api/suggestions/generate',
    { method: 'POST', body: JSON.stringify({ prompt }) },
  )
  return result.data
}
