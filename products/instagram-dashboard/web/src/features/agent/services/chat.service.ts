'use client'

import { apiFetch } from '@/features/shared/services/instagram-api'
import type {
  ChatMessage,
  ChatResponse,
  ClearHistoryResponse,
  DeleteMessageResponse,
} from '@/features/shared/types/instagram.types'

// The chat with the growth agent.
// Split out of a 538-line `instagram.service.ts` that answered for every
// screen at once; a change to carousels meant opening the file the dashboard
// imports too.

// ── Growth Agent ──

export async function sendChatMessage(
  message: string,
  sessionId?: string,
  history?: { role: string; content: string }[],
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

export async function clearChatHistory(sessionId: string): Promise<ClearHistoryResponse> {
  const result = await apiFetch<{ success: true; data: ClearHistoryResponse }>(
    `/api/chat/history?sessionId=${encodeURIComponent(sessionId)}`,
    { method: 'DELETE' },
  );
  return result.data;
}

// ── Growth ──

export async function deleteChatMessage(id: string): Promise<DeleteMessageResponse> {
  const result = await apiFetch<{ success: true; data: DeleteMessageResponse }>(
    `/api/chat/messages/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
  return result.data;
}
