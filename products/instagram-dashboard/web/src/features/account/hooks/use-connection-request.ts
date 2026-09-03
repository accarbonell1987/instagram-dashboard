'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  getConnectionRequest,
  requestConnection,
  type ConnectionRequest,
} from '@/features/account/services/connection.service'

/**
 * Polling, no websocket.
 *
 * El estado cambia UNA vez y horas despues: el operador recibe un correo, entra
 * al App Dashboard de Meta y da el alta. Sostener una conexion abierta toda la
 * sesion para eso cuesta configuracion de nginx, limites de conexion y un modo
 * de falla nuevo, en un servidor compartido con siete sistemas de clientes.
 *
 * Se detiene cuando ya no hay nada que esperar: sin solicitud, conectado, o
 * fallado. Un intervalo que sigue corriendo sobre un estado terminal es trafico
 * que nadie lee.
 */
const POLL_INTERVAL_MS = 15_000

const WAITING_STATES = ['awaiting_invite', 'invite_sent'] as const

export interface ConnectionRequestState {
  request: ConnectionRequest | null
  isLoading: boolean
  error: string | null
  submit: (username: string) => Promise<void>
  refresh: () => Promise<void>
}

export function useConnectionRequest(): ConnectionRequestState {
  const [request, setRequest] = useState<ConnectionRequest | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // La peticion sobrevive al desmontaje: sin esta guarda, la respuesta escribe
  // estado sobre un componente que ya no existe.
  const isMounted = useRef(true)
  useEffect(() => () => { isMounted.current = false }, [])

  const refresh = useCallback(async () => {
    try {
      const found = await getConnectionRequest()
      if (isMounted.current) setRequest(found)
    } catch {
      // Un fallo de red no puede borrar de la pantalla lo que ya sabiamos: el
      // usuario quedaria mirando el paso 1 con una solicitud ya hecha.
    } finally {
      if (isMounted.current) setIsLoading(false)
    }
  }, [])

  const submit = useCallback(async (username: string) => {
    setError(null)
    try {
      const saved = await requestConnection(username)
      if (isMounted.current) setRequest(saved)
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'No pudimos registrar tu solicitud.')
      }
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const isWaiting = request !== null && (WAITING_STATES as readonly string[]).includes(request.status)

  useEffect(() => {
    if (!isWaiting) return
    const id = setInterval(() => { void refresh() }, POLL_INTERVAL_MS)
    return () => { clearInterval(id) }
  }, [isWaiting, refresh])

  return { request, isLoading, error, submit, refresh }
}
