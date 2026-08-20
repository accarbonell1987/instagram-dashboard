'use client'

import { apiFetch } from '@/features/shared/services/instagram-api'
import type {
  DashboardData,
  DashboardQueryParams,
  DemographicsData,
  GrowthDataPoint,
  GrowthMetric,
  GrowthPeriod,
  InsightResult,
} from '@/features/shared/types/instagram.types'

// The account's metrics.
// Split out of a 538-line `instagram.service.ts` that answered for every
// screen at once; a change to carousels meant opening the file the dashboard
// imports too.

// ── Dashboard ──

export async function getDashboardData(params?: DashboardQueryParams): Promise<DashboardData> {
  const query = params?.period ? `?period=${params.period}` : '';
  const result = await apiFetch<{ success: true; data: DashboardData }>(`/api/dashboard${query}`);
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

// ── Demographics ──

export async function getDemographics(): Promise<DemographicsData> {
  const result = await apiFetch<{ success: true; data: DemographicsData }>(
    '/api/dashboard/demographics',
  );
  return result.data;
}

// ── Growth Agent ──

export async function getInsight(): Promise<InsightResult> {
  const result = await apiFetch<{ success: true; data: InsightResult }>('/api/dashboard/insight');
  return result.data;
}

// ── Media ──
