'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

import {
  sendChatMessage,
  getSuggestions,
  getSuggestionBatches,
  markSuggestionUsed,
  dismissSuggestion,
  getChatHistory,
  deleteChatMessage as deleteChatMessageSvc,
  clearChatHistory as clearChatHistorySvc,
  getAgentSettings,
  saveAgentSettings,
} from '../services/instagram.service'
import type { ChatMessage, ContentSuggestion, SuggestionBatch, AgentConfig, AgentSettingsResponse } from '../types/instagram.types'

const SESSION_ID_KEY = 'corehub:growth-agent:sessionId'

interface UseGrowthAgentResult {
  messages: ChatMessage[]
  suggestions: ContentSuggestion[]
  suggestionBatches: SuggestionBatch[]
  isLoading: boolean
  sessionId: string
  error: string | null
  sendMessage: (text: string) => Promise<void>
  markUsed: (id: string, linkedMediaId: string) => Promise<void>
  dismiss: (id: string) => Promise<void>
  deleteMessage: (id: string) => Promise<void>
  clearConversation: () => Promise<void>
  selectedIds: Set<string>
  toggleSelection: (id: string) => void
  deleteSelected: () => Promise<void>
  clearSelection: () => void
  clearSuggestions: () => Promise<void>
  refreshSuggestions: () => Promise<void>
  // Agent config
  agentConfig: AgentConfig | null
  hasFalApiKey: boolean
  isSettingsOpen: boolean
  openSettings: () => void
  closeSettings: () => void
  saveAgentConfig: (config: AgentConfig) => Promise<void>
}

export function useGrowthAgent(): UseGrowthAgentResult {
  const [sessionId, setSessionId] = useState<string>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [suggestions, setSuggestions] = useState<ContentSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null)
  const [hasFalApiKey, setHasFalApiKey] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Read sessionId from localStorage on mount, generate if missing
  useEffect(() => {
    const stored = localStorage.getItem(SESSION_ID_KEY)
    if (stored) {
      setSessionId(stored)
    } else {
      const newId = crypto.randomUUID()
      localStorage.setItem(SESSION_ID_KEY, newId)
      setSessionId(newId)
    }
  }, [])

  // Load suggestion batches — extracted so it can be called after chat responses too
  const [suggestionBatches, setSuggestionBatches] = useState<SuggestionBatch[]>([])

  const loadBatches = useCallback(async () => {
    const data = await getSuggestionBatches(1, 50)
    setSuggestionBatches(data.batches)
    setSuggestions(data.batches.flatMap((b) => b.suggestions))
  }, [])

  useEffect(() => {
    if (!sessionId) return
    loadBatches().catch(() => {
      // Silently fail — suggestions panel shows empty state
    })
  }, [sessionId, loadBatches])

  // T-10: Restore chat history on mount (cold start only)
  const historyRestoredRef = useRef(false)
  useEffect(() => {
    if (!sessionId || historyRestoredRef.current) return
    historyRestoredRef.current = true
    getChatHistory(sessionId)
      .then((msgs) => {
        // Guard: only apply if state is still empty (handles race with sendMessage)
        setMessages((prev) => (prev.length === 0 ? msgs : prev))
      })
      .catch(() => {
        // Silently fail — messages stay empty
      })
  }, [sessionId])

  // Load agent config on mount
  const configLoadedRef = useRef(false)
  useEffect(() => {
    if (!sessionId || configLoadedRef.current) return
    configLoadedRef.current = true
    getAgentSettings()
      .then((response: AgentSettingsResponse) => {
        setAgentConfig(response.agentConfig)
        setHasFalApiKey(response.hasFalApiKey)
      })
      .catch(() => {
        // Silently fail — config stays null (default prompt)
      })
  }, [sessionId])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return

      setError(null)
      setIsLoading(true)

      // Optimistically append user message
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        sessionId,
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, userMsg])

      try {
        // Build history from current messages (excluding the just-appended user msg)
        const history = messages.map((m) => ({ role: m.role, content: m.content }))

        const response = await sendChatMessage(text, sessionId, history)

        // Append assistant reply
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          sessionId: response.sessionId,
          role: 'assistant',
          content: response.reply,
          createdAt: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, assistantMsg])

        // Reload batches so new suggestions appear in the grouped panel view
        if (response.suggestions.length > 0) {
          await loadBatches()
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al enviar el mensaje'
        setError(message)
        // Remove the optimistically added user message on failure
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
      } finally {
        setIsLoading(false)
      }
    },
    [messages, sessionId, isLoading, loadBatches],
  )

  const markUsed = useCallback(
    async (id: string, linkedMediaId: string) => {
      // Optimistic update
      setSuggestions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: 'used' as const } : s)),
      )
      try {
        await markSuggestionUsed(id, linkedMediaId)
      } catch {
        // Revert on failure
        setSuggestions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status: 'pending' as const } : s)),
        )
      }
    },
    [],
  )

  const dismiss = useCallback(
    async (id: string) => {
      // Optimistic removal
      setSuggestions((prev) => prev.filter((s) => s.id !== id))
      try {
        await dismissSuggestion(id)
      } catch {
        // On failure, re-fetch suggestions to restore correct state
        getSuggestions('pending')
          .then((data) => setSuggestions(data))
          .catch(() => {/* silently fail */})
      }
    },
    [],
  )

  const deleteMessage = useCallback(
    async (id: string) => {
      // Optimistic removal
      setMessages((prev) => {
        const snapshot = prev
        const filtered = prev.filter((m) => m.id !== id)
        // If nothing was removed (id not found), skip the API call
        if (filtered.length === snapshot.length) return prev
        return filtered
      })

      try {
        await deleteChatMessageSvc(id)
      } catch {
        // Revert: re-fetch history to restore correct state
        getChatHistory(sessionId)
          .then((msgs) => setMessages(msgs))
          .catch(() => {/* silently fail */})
      }
    },
    [sessionId],
  )

  const clearConversation = useCallback(
    async () => {
      const snapshot = messages
      // Optimistic: clear all
      setMessages([])

      try {
        await clearChatHistorySvc(sessionId)
      } catch {
        // Revert: restore snapshot
        setMessages(snapshot)
      }
    },
    [messages, sessionId],
  )

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const deleteSelected = useCallback(
    async () => {
      const ids = Array.from(selectedIds)
      if (ids.length === 0) return

      // Clear selection immediately
      setSelectedIds(new Set())

      // Optimistic: remove all selected messages
      setMessages((prev) => prev.filter((m) => !ids.includes(m.id)))

      try {
        await Promise.all(ids.map((id) => deleteChatMessageSvc(id)))
      } catch {
        // Revert: re-fetch history to restore correct state
        getChatHistory(sessionId)
          .then((msgs) => setMessages(msgs))
          .catch(() => {/* silently fail */})
        // Restore selection
        setSelectedIds(new Set(ids))
      }
    },
    [selectedIds, sessionId],
  )

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const clearSuggestions = useCallback(
    async () => {
      const ids = suggestions.map((s) => s.id)
      setSuggestions([])
      try {
        await Promise.all(ids.map((id) => dismissSuggestion(id)))
      } catch {
        getSuggestions('pending')
          .then((data) => setSuggestions(data))
          .catch(() => {/* silently fail */})
      }
    },
    [suggestions],
  )

  const refreshSuggestions = loadBatches

  const openSettings = useCallback(() => setIsSettingsOpen(true), [])
  const closeSettings = useCallback(() => setIsSettingsOpen(false), [])

  const saveAgentConfig = useCallback(
    async (config: AgentConfig, falApiKey?: string) => {
      try {
        await saveAgentSettings(config, falApiKey)
        setAgentConfig(config)
        if (falApiKey) setHasFalApiKey(true)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al guardar configuración'
        setError(message)
      }
    },
    [],
  )

  return {
    messages,
    suggestions,
    suggestionBatches,
    isLoading,
    sessionId,
    error,
    sendMessage,
    markUsed,
    dismiss,
    deleteMessage,
    clearConversation,
    selectedIds,
    toggleSelection,
    deleteSelected,
    clearSelection,
    clearSuggestions,
    refreshSuggestions,
    agentConfig,
    hasFalApiKey,
    isSettingsOpen,
    openSettings,
    closeSettings,
    saveAgentConfig,
  }
}
