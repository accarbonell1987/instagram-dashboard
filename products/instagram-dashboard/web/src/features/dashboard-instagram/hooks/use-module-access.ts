'use client'

import { useState, useEffect, useCallback } from 'react'

import { getMyModules } from '../services/instagram.service'

interface UseModuleAccessResult {
  // null means "unknown" (loading or failed) — callers must treat it as
  // nothing-granted, never as "everything granted". A non-null empty Set is
  // a real zero-entitlement tenant, which is a valid, distinct state.
  moduleIds: Set<string> | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useModuleAccess(): UseModuleAccessResult {
  const [moduleIds, setModuleIds] = useState<Set<string> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchModules = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const ids = await getMyModules()
      setModuleIds(new Set(ids))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar permisos'
      setError(message)
      // Fail closed: never leave a stale granted set behind a failed refetch.
      setModuleIds(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchModules()
  }, [fetchModules])

  return { moduleIds, isLoading, error, refetch: fetchModules }
}
