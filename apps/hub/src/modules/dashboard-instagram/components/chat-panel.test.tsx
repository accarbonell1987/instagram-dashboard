import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatPanel } from './chat-panel'
import type { UseGrowthAgentResult } from './chat-panel.types'

// Build a mock hook result
function makeHook(overrides: Partial<UseGrowthAgentResult> = {}): UseGrowthAgentResult {
  return {
    messages: [],
    suggestions: [],
    isLoading: false,
    sessionId: 'test-session',
    error: null,
    sendMessage: vi.fn().mockResolvedValue(undefined),
    markUsed: vi.fn().mockResolvedValue(undefined),
    dismiss: vi.fn().mockResolvedValue(undefined),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    clearConversation: vi.fn().mockResolvedValue(undefined),
    selectedIds: new Set<string>(),
    toggleSelection: vi.fn(),
    deleteSelected: vi.fn().mockResolvedValue(undefined),
    clearSelection: vi.fn(),
    clearSuggestions: vi.fn().mockResolvedValue(undefined),
    agentConfig: null,
    isSettingsOpen: false,
    openSettings: vi.fn(),
    closeSettings: vi.fn(),
    saveAgentConfig: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('ChatPanel', () => {
  it('renders without crashing with empty messages state', () => {
    render(<ChatPanel hook={makeHook()} />)
    expect(screen.getByText(/Agente de Crecimiento/i)).toBeInTheDocument()
  })

  it('user types and clicks send → sendMessage called with correct text', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined)
    render(<ChatPanel hook={makeHook({ sendMessage })} />)

    const textarea = screen.getByRole('textbox', { name: /Mensaje/i })
    fireEvent.change(textarea, { target: { value: 'Hello agent' } })

    const sendBtn = screen.getByRole('button', { name: /Enviar mensaje/i })
    fireEvent.click(sendBtn)

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('Hello agent')
    })
  })

  it('input and button are disabled while isLoading = true', () => {
    render(<ChatPanel hook={makeHook({ isLoading: true })} />)

    const textarea = screen.getByRole('textbox', { name: /Mensaje/i })
    const sendBtn = screen.getByRole('button', { name: /Enviar mensaje/i })

    expect(textarea).toBeDisabled()
    expect(sendBtn).toBeDisabled()
  })

  it('thinking indicator is visible while loading, hidden after', () => {
    const { rerender } = render(<ChatPanel hook={makeHook({ isLoading: true })} />)

    expect(screen.getByRole('status', { name: /Pensando/i })).toBeInTheDocument()

    rerender(<ChatPanel hook={makeHook({ isLoading: false })} />)

    expect(screen.queryByRole('status', { name: /Pensando/i })).not.toBeInTheDocument()
  })

  it('message list shows both user and assistant messages', () => {
    const messages = [
      {
        id: '1',
        sessionId: 'sess',
        role: 'user' as const,
        content: 'User says hi',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        sessionId: 'sess',
        role: 'assistant' as const,
        content: 'Assistant replies',
        createdAt: new Date().toISOString(),
      },
    ]
    render(<ChatPanel hook={makeHook({ messages })} />)

    expect(screen.getByText('User says hi')).toBeInTheDocument()
    expect(screen.getByText('Assistant replies')).toBeInTheDocument()
  })

  it('send button is disabled when input is empty', () => {
    render(<ChatPanel hook={makeHook()} />)
    const sendBtn = screen.getByRole('button', { name: /Enviar mensaje/i })
    expect(sendBtn).toBeDisabled()
  })

  // T-19: Clear conversation button
  it('"Limpiar conversación" button renders and calls clearConversation', async () => {
    const clearConversation = vi.fn().mockResolvedValue(undefined)
    render(<ChatPanel hook={makeHook({ clearConversation })} />)

    const clearBtn = screen.getByRole('button', { name: /Limpiar conversación/i })
    expect(clearBtn).toBeInTheDocument()

    fireEvent.click(clearBtn)
    expect(clearConversation).toHaveBeenCalledTimes(1)
  })

  // T-19: Selection mode toggle
  it('selection mode toggle shows checkboxes on messages', () => {
    const messages = [
      {
        id: '1',
        sessionId: 'sess',
        role: 'user' as const,
        content: 'User says hi',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        sessionId: 'sess',
        role: 'assistant' as const,
        content: 'Assistant replies',
        createdAt: new Date().toISOString(),
      },
    ]
    render(<ChatPanel hook={makeHook({ messages })} />)

    // Before toggling selection mode — no individual message checkboxes
    // Use exact string (not regex) to distinguish from the header toggle button "Seleccionar mensajes"
    expect(screen.queryByRole('button', { name: 'Seleccionar mensaje' })).not.toBeInTheDocument()

    // Toggle selection mode on
    const selectBtn = screen.getByRole('button', { name: /Seleccionar mensajes/i })
    fireEvent.click(selectBtn)

    // Now checkboxes should appear (exact singular match)
    const checkboxes = screen.getAllByRole('button', { name: 'Seleccionar mensaje' })
    expect(checkboxes).toHaveLength(2)
  })

  // T-19: Bulk delete bar appears when items selected
  it('"Eliminar seleccionados" appears when items are selected', () => {
    const messages = [
      {
        id: '1',
        sessionId: 'sess',
        role: 'user' as const,
        content: 'Message one',
        createdAt: new Date().toISOString(),
      },
    ]
    const selectedIds = new Set<string>(['1'])
    render(<ChatPanel hook={makeHook({ messages, selectedIds })} />)

    // Toggle selection mode on so the bar renders
    const selectBtn = screen.getByRole('button', { name: /Seleccionar mensajes/i })
    fireEvent.click(selectBtn)

    // The delete selected button should appear
    expect(screen.getByRole('button', { name: /Eliminar seleccionados/i })).toBeInTheDocument()
    expect(screen.getByText(/1 seleccionado/i)).toBeInTheDocument()
  })

  // T-19: Delete button appears on message hover (normal mode, not selection)
  it('delete ✕ button passed to ChatMessageBubble', () => {
    const messages = [
      {
        id: 'msg-1',
        sessionId: 'sess',
        role: 'user' as const,
        content: 'A message',
        createdAt: new Date().toISOString(),
      },
    ]
    render(<ChatPanel hook={makeHook({ messages })} />)

    // The delete button should exist (rendered by ChatMessageBubble with onDelete prop)
    const deleteBtn = screen.getByRole('button', { name: /Eliminar mensaje/i })
    expect(deleteBtn).toBeInTheDocument()
  })

  // T-22: Gear icon button for agent settings
  it('gear icon button is visible in header', () => {
    render(<ChatPanel hook={makeHook()} />)
    const gearBtn = screen.getByRole('button', { name: /Configurar agente/i })
    expect(gearBtn).toBeInTheDocument()
  })

  it('clicking gear icon calls openSettings', () => {
    const openSettings = vi.fn()
    render(<ChatPanel hook={makeHook({ openSettings })} />)
    const gearBtn = screen.getByRole('button', { name: /Configurar agente/i })
    fireEvent.click(gearBtn)
    expect(openSettings).toHaveBeenCalledTimes(1)
  })

  it('renders AgentSettingsModal when isSettingsOpen is true', () => {
    render(<ChatPanel hook={makeHook({ isSettingsOpen: true })} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
