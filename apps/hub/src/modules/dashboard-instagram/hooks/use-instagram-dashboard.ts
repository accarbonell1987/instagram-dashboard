'use client'

import { useState, useEffect, useCallback } from 'react'

import {
  getDashboardData,
  getConnectionStatus,
  getSyncStatus,
  triggerSync,
  getGrowthData,
  getReels,
  getPublications,
  getReelDetail,
  getDemographics,
} from '../services/instagram.service'
import type {
  ConnectionStatus,
  DashboardData,
  InstagramPeriod,
  SyncState,
  GrowthDataPoint,
  GrowthMetric,
  GrowthPeriod,
  PaginatedReels,
  PublicationFilter,
  ReelMedia,
  DemographicsData,
} from '../types/instagram.types'

// ── Dashboard hook ──

interface UseInstagramDashboardResult {
  data: DashboardData | null
  isLoading: boolean
  error: string | null
  period: InstagramPeriod
  setPeriod: (period: InstagramPeriod) => void
  refetch: () => Promise<void>
}

export function useInstagramDashboard(
  initialPeriod: InstagramPeriod = '7d',
  options?: { enabled?: boolean },
): UseInstagramDashboardResult {
  const enabled = options?.enabled ?? true
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<InstagramPeriod>(initialPeriod)

  const fetchData = useCallback(async () => {
    if (!enabled) return
    setIsLoading(true)
    setError(null)
    try {
      const result = await getDashboardData({ period })
      setData(result)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error al cargar el dashboard'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [period, enabled])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { data, isLoading, error, period, setPeriod, refetch: fetchData }
}

// ── Connection status hook ──

interface UseConnectionStatusResult {
  isConnected: boolean
  username: string | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useConnectionStatus(): UseConnectionStatusResult {
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await getConnectionStatus()
      setStatus(result)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error al verificar conexión'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  return {
    isConnected: status?.connected ?? false,
    username: status?.username ?? null,
    isLoading,
    error,
    refetch: fetchStatus,
  }
}

// ── Sync status hook (polls every 10s while syncing) ──

interface UseSyncStatusResult {
  syncState: SyncState | null
  isLoading: boolean
  triggerSync: () => Promise<void>
  isTriggering: boolean
}

export function useSyncStatus(options?: { enabled?: boolean }): UseSyncStatusResult {
  const enabled = options?.enabled ?? true
  const [syncState, setSyncState] = useState<SyncState | null>(null)
  const [isLoading, setIsLoading] = useState(enabled)
  const [isTriggering, setIsTriggering] = useState(false)

  const fetchSyncStatus = useCallback(async () => {
    if (!enabled) return
    try {
      const result = await getSyncStatus()
      setSyncState(result)
    } catch {
      // Silently fail for polling — errors are transient
    } finally {
      setIsLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void fetchSyncStatus()

    // Poll every 10 seconds while syncing
    const interval = setInterval(() => {
      if (syncState?.status === 'syncing') {
        void fetchSyncStatus()
      }
    }, 10_000)

    return () => clearInterval(interval)
  }, [fetchSyncStatus, syncState?.status])

  const handleTriggerSync = useCallback(async () => {
    setIsTriggering(true)
    try {
      await triggerSync()
      await fetchSyncStatus()
    } finally {
      setIsTriggering(false)
    }
  }, [fetchSyncStatus])

  return {
    syncState,
    isLoading,
    triggerSync: handleTriggerSync,
    isTriggering,
  }
}

// ── Growth data hook ──

interface UseGrowthDataResult {
  data: GrowthDataPoint[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useGrowthData(
  metric: GrowthMetric,
  period: GrowthPeriod,
  options?: { enabled?: boolean },
): UseGrowthDataResult {
  const enabled = options?.enabled ?? true
  const [data, setData] = useState<GrowthDataPoint[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchTick, setFetchTick] = useState(0)

  const fetchData = useCallback(async () => {
    if (!enabled) return
    setIsLoading(true)
    setError(null)
    try {
      const result = await getGrowthData(metric, period)
      setData(result)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al cargar datos de crecimiento'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [metric, period, enabled])

  const refetch = useCallback(async () => {
    setFetchTick((t) => t + 1)
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData, fetchTick])

  return { data, isLoading, error, refetch }
}

// ── Reels list hook ──

interface UseReelsResult {
  data: PaginatedReels | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useReels(options?: { enabled?: boolean }): UseReelsResult {
  const enabled = options?.enabled ?? true
  const [data, setData] = useState<PaginatedReels | null>(null)
  const [isLoading, setIsLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!enabled) return
    setIsLoading(true)
    setError(null)
    try {
      const result = await getReels(1, 30)
      setData(result)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al cargar Reels'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { data, isLoading, error, refetch: fetchData }
}

// ── Publications hook (all media types, filterable) ──

interface UsePublicationsResult {
  data: PaginatedReels | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function usePublications(
  filter: PublicationFilter,
  options?: { enabled?: boolean },
): UsePublicationsResult {
  const enabled = options?.enabled ?? true
  const [data, setData] = useState<PaginatedReels | null>(null)
  const [isLoading, setIsLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!enabled) return
    setIsLoading(true)
    setError(null)
    try {
      const result = await getPublications(filter, 1, 50)
      setData(result)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al cargar publicaciones'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [enabled, filter])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { data, isLoading, error, refetch: fetchData }
}

// ── Reel detail hook ──

interface UseReelDetailResult {
  data: ReelMedia | null
  isLoading: boolean
  error: string | null
}

export function useReelDetail(mediaId: string | null): UseReelDetailResult {
  const [data, setData] = useState<ReelMedia | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!mediaId) {
      setData(null)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)

    getReelDetail(mediaId)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error al cargar detalle')
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [mediaId])

  return { data, isLoading, error }
}

// ── Demographics hook ──

interface UseDemographicsResult {
  data: DemographicsData | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useDemographics(options?: { enabled?: boolean }): UseDemographicsResult {
  const enabled = options?.enabled ?? true
  const [data, setData] = useState<DemographicsData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!enabled) return
    setIsLoading(true)
    setError(null)
    try {
      const result = await getDemographics()
      setData(result)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al cargar demografía'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { data, isLoading, error, refetch: fetchData }
}
