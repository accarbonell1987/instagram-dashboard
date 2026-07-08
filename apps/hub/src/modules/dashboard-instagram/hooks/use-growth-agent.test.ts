import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useGrowthAgent } from './use-growth-agent'
import type { ChatMessage, ContentSuggestion, ChatResponse } from '../types/instagram.types'
import * as service from '../services/instagram.service'

vi.mock('../services/instagram.service')

const mockedService = vi.mocked(service)

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

const makeSuggestion = (overrides: Partial<ContentSuggestion & { id: string }> = {}) => ({
  id: 'sugg-1',
  category: 'caption' as const,
  content: 'Test suggestion',
  status: 'pending' as const,
  outcome: null,
  createdAt: new Date().toISOString(),
  ...overrides,
})

describe('useGrowthAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    // Default mocks for new service functions
    mockedService.getSuggestions.mockResolvedValue([])
    mockedService.getSuggestionBatches.mockResolvedValue({ batches: [], total: 0, page: 1, limit: 50 })
    mockedService.getChatHistory.mockResolvedValue([])
    mockedService.deleteChatMessage.mockResolvedValue({ deleted: true })
    mockedService.clearChatHistory.mockResolvedValue({ deletedCount: 0 })
    mockedService.getAgentSettings.mockResolvedValue({ agentConfig: null, hasFalApiKey: false })
    mockedService.saveAgentSettings.mockResolvedValue(undefined)
  })

  it('sendMessage appends user message then assistant reply after await', async () => {
    mockedService.sendChatMessage.mockResolvedValue({
      reply: 'Assistant reply',
      sessionId: 'sess-1',
      suggestions: [],
      toolCallsTrace: [],
    })

    const { result } = renderHook(() => useGrowthAgent())

    await waitFor(() => {
      expect(result.current.sessionId).not.toBe('')
    })

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0]?.role).toBe('user')
    expect(result.current.messages[0]?.content).toBe('Hello')
    expect(result.current.messages[1]?.role).toBe('assistant')
    expect(result.current.messages[1]?.content).toBe('Assistant reply')
  })

  it('isLoading is true during sendMessage, false after', async () => {
    let resolveChat: (value: ChatResponse) => void
    const chatPromise = new Promise<ChatResponse>((resolve) => {
      resolveChat = resolve
    })
    mockedService.sendChatMessage.mockReturnValue(chatPromise)

    const { result } = renderHook(() => useGrowthAgent())

    await waitFor(() => expect(result.current.sessionId).not.toBe(''))

    // Start send (don't await)
    act(() => {
      void result.current.sendMessage('Test')
    })

    // isLoading should be true immediately after
    await waitFor(() => {
      expect(result.current.isLoading).toBe(true)
    })

    // Resolve the promise
    await act(async () => {
      resolveChat({
        reply: 'Done',
        sessionId: 'sess-1',
        suggestions: [],
        toolCallsTrace: [],
      })
      await chatPromise
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('suggestions are appended from chat response', async () => {
    const newSuggestion = makeSuggestion({ id: 'sugg-from-chat' })
    mockedService.sendChatMessage.mockResolvedValue({
      reply: 'Here are some suggestions',
      sessionId: 'sess-1',
      suggestions: [newSuggestion],
      toolCallsTrace: [],
    })

    const { result } = renderHook(() => useGrowthAgent())

    await waitFor(() => expect(result.current.sessionId).not.toBe(''))

    await act(async () => {
      await result.current.sendMessage('Give me suggestions')
    })

    expect(result.current.suggestions).toHaveLength(1)
    expect(result.current.suggestions[0]?.id).toBe('sugg-from-chat')
  })

  it('markUsed optimistically updates suggestion status to used', async () => {
    const suggestion = makeSuggestion({ id: 'sugg-to-use', status: 'pending' })
    mockedService.sendChatMessage.mockResolvedValue({
      reply: 'ok',
      sessionId: 'sess-1',
      suggestions: [suggestion],
      toolCallsTrace: [],
    })
    mockedService.markSuggestionUsed.mockResolvedValue(undefined)

    const { result } = renderHook(() => useGrowthAgent())

    await waitFor(() => expect(result.current.sessionId).not.toBe(''))

    // Add suggestion via chat
    await act(async () => {
      await result.current.sendMessage('msg')
    })

    expect(result.current.suggestions[0]?.status).toBe('pending')

    // Mark used
    await act(async () => {
      await result.current.markUsed('sugg-to-use', 'media-123')
    })

    expect(result.current.suggestions[0]?.status).toBe('used')
    expect(mockedService.markSuggestionUsed).toHaveBeenCalledWith('sugg-to-use', 'media-123')
  })

  it('dismiss removes suggestion from list', async () => {
    const suggestion = makeSuggestion({ id: 'sugg-to-dismiss' })
    mockedService.sendChatMessage.mockResolvedValue({
      reply: 'ok',
      sessionId: 'sess-1',
      suggestions: [suggestion],
      toolCallsTrace: [],
    })
    mockedService.dismissSuggestion.mockResolvedValue(undefined)

    const { result } = renderHook(() => useGrowthAgent())

    await waitFor(() => expect(result.current.sessionId).not.toBe(''))

    await act(async () => {
      await result.current.sendMessage('msg')
    })

    expect(result.current.suggestions).toHaveLength(1)

    await act(async () => {
      await result.current.dismiss('sugg-to-dismiss')
    })

    expect(result.current.suggestions).toHaveLength(0)
    expect(mockedService.dismissSuggestion).toHaveBeenCalledWith('sugg-to-dismiss')
  })

  it('sessionId is read from localStorage on mount and persisted', async () => {
    const storedId = 'stored-session-uuid'
    localStorageMock.setItem('corehub:growth-agent:sessionId', storedId)

    const { result } = renderHook(() => useGrowthAgent())

    await waitFor(() => {
      expect(result.current.sessionId).toBe(storedId)
    })

    // It should NOT overwrite the stored value
    expect(localStorageMock.getItem('corehub:growth-agent:sessionId')).toBe(storedId)
  })

  it('generates a new sessionId if not found in localStorage and persists it', async () => {
    const { result } = renderHook(() => useGrowthAgent())

    await waitFor(() => {
      expect(result.current.sessionId).not.toBe('')
    })

    const stored = localStorageMock.getItem('corehub:growth-agent:sessionId')
    expect(stored).toBe(result.current.sessionId)
    expect(stored).toMatch(/^[0-9a-f-]{36}$/) // uuid format
  })

  // T-10: History restore on mount
  it('restores chat history on mount when sessionId is in localStorage', async () => {
    const storedId = 'restore-session-uuid'
    localStorageMock.setItem('corehub:growth-agent:sessionId', storedId)

    const historyMessages: ChatMessage[] = [
      { id: 'h-1', sessionId: storedId, role: 'user', content: 'Old message 1', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'h-2', sessionId: storedId, role: 'assistant', content: 'Old reply 1', createdAt: '2026-01-01T00:00:01.000Z' },
    ]
    mockedService.getChatHistory.mockResolvedValue(historyMessages)

    const { result } = renderHook(() => useGrowthAgent())

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2)
    })

    expect(result.current.messages[0]?.content).toBe('Old message 1')
    expect(result.current.messages[1]?.content).toBe('Old reply 1')
  })

  it('does NOT restore history if there are already messages in state', async () => {
    const storedId = 'cold-start-uuid'
    localStorageMock.setItem('corehub:growth-agent:sessionId', storedId)

    // sendChatMessage success → appends user + assistant messages to state
    mockedService.sendChatMessage.mockResolvedValue({
      reply: 'Assistant reply',
      sessionId: storedId,
      suggestions: [],
      toolCallsTrace: [],
    })

    // Defer getChatHistory resolution so we can control the order
    let resolveHistory!: (value: ChatMessage[]) => void
    const historyPromise = new Promise<ChatMessage[]>((resolve) => {
      resolveHistory = resolve
    })
    mockedService.getChatHistory.mockReturnValue(historyPromise)

    const { result } = renderHook(() => useGrowthAgent())

    await waitFor(() => expect(result.current.sessionId).not.toBe(''))

    // Send a message first — this populates messages before history resolves
    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    // Now resolve history — should be ignored because messages.length > 0
    await act(async () => {
      resolveHistory([
        { id: 'h-1', sessionId: storedId, role: 'user', content: 'Should not appear', createdAt: '2026-01-01T00:00:00.000Z' },
      ])
    })

    // Messages should still have 2 (user + assistant from sendMessage)
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0]?.content).toBe('Hello')
    expect(result.current.messages[1]?.content).toBe('Assistant reply')
  })

  it('silently fails if getChatHistory errors', async () => {
    const storedId = 'error-restore-uuid'
    localStorageMock.setItem('corehub:growth-agent:sessionId', storedId)

    mockedService.getChatHistory.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useGrowthAgent())

    await waitFor(() => {
      expect(result.current.sessionId).toBe(storedId)
    })

    // Messages should stay empty
    expect(result.current.messages).toHaveLength(0)
    expect(result.current.error).toBeNull()
  })

  // T-11: deleteMessage
  it('deleteMessage removes message optimistically and calls API', async () => {
    // Populate messages via chat
    mockedService.sendChatMessage.mockResolvedValue({
      reply: 'OK',
      sessionId: 'sess-1',
      suggestions: [],
      toolCallsTrace: [],
    })

    mockedService.deleteChatMessage.mockResolvedValue({ deleted: true })

    const { result } = renderHook(() => useGrowthAgent())

    await waitFor(() => expect(result.current.sessionId).not.toBe(''))

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    // Should have 2 messages (user + assistant)
    expect(result.current.messages).toHaveLength(2)

    const msgToDelete = result.current.messages[0]!

    await act(async () => {
      await result.current.deleteMessage(msgToDelete.id)
    })

    // Message should be removed
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]?.id).not.toBe(msgToDelete.id)
    expect(mockedService.deleteChatMessage).toHaveBeenCalledWith(msgToDelete.id)
  })

  it('deleteMessage reverts on API failure', async () => {
    mockedService.sendChatMessage.mockResolvedValue({
      reply: 'OK',
      sessionId: 'sess-1',
      suggestions: [],
      toolCallsTrace: [],
    })

    mockedService.deleteChatMessage.mockRejectedValue(new Error('API error'))
    // First call (mount history restore) → empty; Second call (error revert) → original messages
    mockedService.getChatHistory
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'orig-1', sessionId: 'sess-1', role: 'user', content: 'Hello', createdAt: new Date().toISOString() },
        { id: 'orig-2', sessionId: 'sess-1', role: 'assistant', content: 'OK', createdAt: new Date().toISOString() },
      ])

    const { result } = renderHook(() => useGrowthAgent())

    await waitFor(() => expect(result.current.sessionId).not.toBe(''))

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(result.current.messages).toHaveLength(2)
    const originalMessages = [...result.current.messages]

    await act(async () => {
      await result.current.deleteMessage(result.current.messages[0]!.id)
    })

    // Should revert — both messages restored via getChatHistory
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0]?.content).toBe('Hello')
    expect(result.current.messages[1]?.content).toBe('OK')
  })

  // T-11: clearConversation
  it('clearConversation clears all messages and calls DELETE /history', async () => {
    mockedService.sendChatMessage.mockResolvedValue({
      reply: 'OK',
      sessionId: 'sess-1',
      suggestions: [],
      toolCallsTrace: [],
    })

    mockedService.clearChatHistory.mockResolvedValue({ deletedCount: 5 })

    const { result } = renderHook(() => useGrowthAgent())

    await waitFor(() => expect(result.current.sessionId).not.toBe(''))

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(result.current.messages).toHaveLength(2)

    await act(async () => {
      await result.current.clearConversation()
    })

    expect(result.current.messages).toHaveLength(0)
    expect(mockedService.clearChatHistory).toHaveBeenCalledWith(result.current.sessionId)
  })

  it('clearConversation restores messages on API failure', async () => {
    mockedService.sendChatMessage.mockResolvedValue({
      reply: 'OK',
      sessionId: 'sess-1',
      suggestions: [],
      toolCallsTrace: [],
    })

    mockedService.clearChatHistory.mockRejectedValue(new Error('API error'))

    const { result } = renderHook(() => useGrowthAgent())

    await waitFor(() => expect(result.current.sessionId).not.toBe(''))

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(result.current.messages).toHaveLength(2)
    const originalMessages = [...result.current.messages]

    await act(async () => {
      await result.current.clearConversation()
    })

    // Should have restored original messages
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0]?.id).toBe(originalMessages[0]?.id)
  })

  // ── Agent Config ──

  it('loads agent config on mount (null by default)', async () => {
    mockedService.getAgentSettings.mockResolvedValue({ agentConfig: null, hasFalApiKey: false })

    const { result } = renderHook(() => useGrowthAgent())

    await waitFor(() => {
      expect(result.current.agentConfig).toBeNull()
    })
    expect(mockedService.getAgentSettings).toHaveBeenCalled()
  })

  it('loads agent config on mount (with data)', async () => {
    const config = { niche: 'Moda', tags: ['Ropa', 'Tendencias'] }
    mockedService.getAgentSettings.mockResolvedValue({ agentConfig: config, hasFalApiKey: true })

    const { result } = renderHook(() => useGrowthAgent())

    await waitFor(() => {
      expect(result.current.agentConfig).toEqual(config)
    })
    expect(result.current.hasFalApiKey).toBe(true)
  })

  it('silently fails if getAgentSettings errors', async () => {
    mockedService.getAgentSettings.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useGrowthAgent())

    await waitFor(() => {
      expect(result.current.sessionId).not.toBe('')
    })

    // agentConfig stays null on error
    expect(result.current.agentConfig).toBeNull()
  })

  it('saveAgentConfig calls saveAgentSettings and updates state', async () => {
    mockedService.getAgentSettings.mockResolvedValue({ agentConfig: null, hasFalApiKey: false })
    mockedService.saveAgentSettings.mockResolvedValue(undefined)

    const { result } = renderHook(() => useGrowthAgent())

    await waitFor(() => {
      expect(result.current.agentConfig).toBeNull()
    })

    const newConfig = { niche: 'Tecnología', tags: ['Gadgets'] }

    await act(async () => {
      await result.current.saveAgentConfig(newConfig)
    })

    expect(mockedService.saveAgentSettings).toHaveBeenCalledWith(newConfig, undefined)
    expect(result.current.agentConfig).toEqual(newConfig)
  })

  it('saveAgentConfig sets error on API failure', async () => {
    mockedService.getAgentSettings.mockResolvedValue({ agentConfig: null, hasFalApiKey: false })
    mockedService.saveAgentSettings.mockRejectedValue(new Error('Save failed'))

    const { result } = renderHook(() => useGrowthAgent())

    await waitFor(() => {
      expect(result.current.agentConfig).toBeNull()
    })

    await act(async () => {
      await result.current.saveAgentConfig({ niche: 'Test', tags: ['Tag'] })
    })

    expect(result.current.error).toBe('Save failed')
  })

  it('openSettings sets isSettingsOpen to true', async () => {
    const { result } = renderHook(() => useGrowthAgent())

    await waitFor(() => expect(result.current.sessionId).not.toBe(''))

    act(() => {
      result.current.openSettings()
    })

    expect(result.current.isSettingsOpen).toBe(true)
  })

  it('closeSettings sets isSettingsOpen to false', async () => {
    const { result } = renderHook(() => useGrowthAgent())

    await waitFor(() => expect(result.current.sessionId).not.toBe(''))

    act(() => {
      result.current.openSettings()
    })
    expect(result.current.isSettingsOpen).toBe(true)

    act(() => {
      result.current.closeSettings()
    })
    expect(result.current.isSettingsOpen).toBe(false)
  })
})
