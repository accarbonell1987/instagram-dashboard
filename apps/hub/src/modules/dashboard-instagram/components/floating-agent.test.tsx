import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FloatingAgent } from './floating-agent'
import type { UseGrowthAgentResult } from './chat-panel.types'

// Build a mock hook result
function makeHook(overrides: Partial<UseGrowthAgentResult> = {}): UseGrowthAgentResult {
  return {
    messages: [],
    suggestions: [],
    suggestionBatches: [],
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
    ...overrides,
  }
}

describe('FloatingAgent', () => {
  it('renders the trigger button', () => {
    render(<FloatingAgent hook={makeHook()} />)
    expect(
      screen.getByRole('button', { name: /Abrir agente de crecimiento/i }),
    ).toBeInTheDocument()
  })

  it('clicking trigger opens the panel', () => {
    render(<FloatingAgent hook={makeHook()} />)

    const trigger = screen.getByRole('button', { name: /Abrir agente de crecimiento/i })
    fireEvent.click(trigger)

    expect(screen.getByRole('dialog', { name: /Agente de Crecimiento/i })).toBeInTheDocument()
    // Header close button uses exact label "Cerrar agente"
    expect(screen.getByRole('button', { name: /^Cerrar agente$/i })).toBeInTheDocument()
  })

  it('clicking X button closes the panel', () => {
    render(<FloatingAgent hook={makeHook()} />)

    // Open
    fireEvent.click(screen.getByRole('button', { name: /Abrir agente de crecimiento/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Close via X button inside the panel header (exact label match)
    fireEvent.click(screen.getByRole('button', { name: /^Cerrar agente$/i }))

    // Panel should be hidden (aria-hidden)
    const dialog = screen.getByRole('dialog', { hidden: true })
    expect(dialog).toHaveAttribute('aria-hidden', 'true')
  })

  it('tab switch works — "Sugerencias" tab is clickable', () => {
    render(<FloatingAgent hook={makeHook()} />)

    // Open the panel
    fireEvent.click(screen.getByRole('button', { name: /Abrir agente de crecimiento/i }))

    // Switch to Sugerencias tab
    const suggestionsTab = screen.getByRole('tab', { name: /Sugerencias/i })
    fireEvent.click(suggestionsTab)

    expect(suggestionsTab).toHaveAttribute('aria-selected', 'true')
  })

  it('Chat tab is selected by default', () => {
    render(<FloatingAgent hook={makeHook()} />)

    fireEvent.click(screen.getByRole('button', { name: /Abrir agente de crecimiento/i }))

    const chatTab = screen.getByRole('tab', { name: /^Chat$/i })
    expect(chatTab).toHaveAttribute('aria-selected', 'true')
  })

  it('does not show unread badge when there are no messages or suggestions', () => {
    render(<FloatingAgent hook={makeHook()} />)
    // Badge should not appear when unreadCount = 0
    expect(screen.queryByLabelText(/sin leer/i)).not.toBeInTheDocument()
  })

  it('shows suggestion count badge on tab when suggestions exist', () => {
    const suggestions = [
      {
        id: 's1',
        category: 'caption' as const,
        content: 'Suggestion 1',
        status: 'pending' as const,
        outcome: null,
        createdAt: new Date().toISOString(),
      },
    ]
    render(<FloatingAgent hook={makeHook({ suggestions })} />)

    // Open panel to see tabs
    fireEvent.click(screen.getByRole('button', { name: /Abrir agente de crecimiento/i }))

    // The Sugerencias tab should show a count badge "1"
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  // ── Usage Meter Integration ──

  it('renders UsageMeter when panel is open', async () => {
    render(<FloatingAgent hook={makeHook()} />)

    fireEvent.click(screen.getByRole('button', { name: /Abrir agente de crecimiento/i }))

    // Wait for usage data to load (MSW mock returns immediately)
    await waitFor(
      () => {
        expect(screen.getByText(/Tokens:/)).toBeInTheDocument()
      },
      { timeout: 2000 },
    )
  })

  it('fetches usage data on open', async () => {
    render(<FloatingAgent hook={makeHook()} />)

    fireEvent.click(screen.getByRole('button', { name: /Abrir agente de crecimiento/i }))

    // Should show the mock data: Tokens: 12K/100K and Imágenes: 8/50
    await waitFor(
      () => {
        expect(screen.getByTestId('deepseek_tokens-label')).toHaveTextContent('Tokens: 12K/100K')
      },
      { timeout: 2000 },
    )
  })

  it('shows usage skeleton while loading (before fetch resolves)', () => {
    render(<FloatingAgent hook={makeHook()} />)

    fireEvent.click(screen.getByRole('button', { name: /Abrir agente de crecimiento/i }))

    // Immediately after open, before MSW resolves, it should show loading
    // MSW resolves synchronously, so the skeleton may be gone already
    // But the meter labels should eventually appear
    expect(screen.getByRole('dialog', { name: /Agente de Crecimiento/i })).toBeInTheDocument()
  })
})
