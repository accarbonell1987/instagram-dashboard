'use client'

import { apiFetch } from '@/features/shared/services/instagram-api'
import type {
  AgentConfig,
  AgentSecrets,
  AgentSettingsResponse,
  UsageResponse,
} from '@/features/shared/types/instagram.types'

// The agent's own configuration and quota usage.
// Split out of a 538-line `instagram.service.ts` that answered for every
// screen at once; a change to carousels meant opening the file the dashboard
// imports too.

// ── Agent Config ──

export async function getAgentSettings(): Promise<AgentSettingsResponse> {
  const result = await apiFetch<{ success: true; data: AgentSettingsResponse }>(
    '/api/agent/settings',
  );
  return result.data;
}

export async function saveAgentSettings(
  config: AgentConfig,
  secrets?: AgentSecrets,
): Promise<void> {
  await apiFetch<{ success: true; data: unknown }>('/api/agent/settings', {
    method: 'PUT',
    body: JSON.stringify({
      ...config,
      // Omitted when blank rather than sent empty: the backend treats a present
      // key as a replacement, so an empty string would erase a working one.
      ...(secrets?.falApiKey !== undefined && { falApiKey: secrets.falApiKey }),
      ...(secrets?.llmApiKey !== undefined && { llmApiKey: secrets.llmApiKey }),
    }),
  });
}

// ── Carousel ──

// ── Usage / Quota ──

export async function getUsage(): Promise<UsageResponse> {
  const result = await apiFetch<{ success: true; data: UsageResponse }>('/api/agent/usage');
  return result.data;
}
