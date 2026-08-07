'use client'

import { useEffect, useState } from 'react'

import { subscribeToToken } from '../lib/hub-token'

/**
 * The JWT the hub delivers over postMessage, or null until it arrives.
 *
 * The hub loads this app in an iframe and pushes the token asynchronously, so
 * on a refresh the app mounts before it has one. Anything that authenticates a
 * request has to wait for this rather than firing on mount and answering 401.
 */
export function useHubToken(): string | null {
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => subscribeToToken(setToken), [])

  return token
}
