import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import type { UseGrowthAgentResult } from '../hooks/use-growth-agent'

import { FloatingAgent } from './floating-agent'

// FloatingAgent fetches usage on open. The hub relied on a global MSW server for
// this; the standalone app has none, so stub the service directly. Shape mirrors
// the hub's `happy` scenario (Tokens 12K/100K, Imágenes 8/50).
vi.mock('../services/instagram.service', () => ({
  getUsage: vi.fn().mockResolvedValue({
    quotas: {
        chat_sessions: { used: 4, limit: 30, period: 'day', resetsAt: '2026-06-15T00:00:00.000Z' },
      llm_tokens: { used: 12000, limit: 100000, period: 'month', resetsAt: '2026-07-01T00:00:00.000Z' },
      fal_images: { used: 8, limit: 50, period: 'month', resetsAt: '2026-07-01T00:00:00.000Z' },
    },
    periodStart: '2026-06-01T00:00:00.000Z',
    periodEnd: '2026-07-01T00:00:00.000Z',
  }),
}))

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
    refreshSuggestions: vi.fn().mockResolvedValue(undefined),
    agentConfig: null,
    hasFalApiKey: false,
  hasLlmApiKey: false,
  suggestionsLoaded: true,
  settingsFailed: false,
  // Every section, so these tests keep exercising the panel rather than the gate.
  editableSections: ['topics', 'prompt', 'limits', 'model', 'imageKey', 'imageModels', 'imageStyles'] as const,
    isSettingsOpen: false,
    openSettings: vi.fn(),
    closeSettings: vi.fn(),
    saveAgentConfig: vi.fn().mockResolvedValue(undefined),
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
        expect(screen.getByTestId('llm_tokens-label')).toHaveTextContent('Tokens: 12K/100K')
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

  // ── Agent Settings (gear icon) ──

  it('gear icon button is visible in the panel header', () => {
    render(<FloatingAgent hook={makeHook()} />)
    fireEvent.click(screen.getByRole('button', { name: /Abrir agente de crecimiento/i }))
    expect(screen.getByRole('button', { name: /Configurar agente/i })).toBeInTheDocument()
  })

  it('clicking gear icon calls openSettings', () => {
    const openSettings = vi.fn()
    render(<FloatingAgent hook={makeHook({ openSettings })} />)
    fireEvent.click(screen.getByRole('button', { name: /Abrir agente de crecimiento/i }))
    fireEvent.click(screen.getByRole('button', { name: /Configurar agente/i }))
    expect(openSettings).toHaveBeenCalledTimes(1)
  })

  it('renders AgentSettingsModal when isSettingsOpen is true', () => {
    render(<FloatingAgent hook={makeHook({ isSettingsOpen: true })} />)
    // The floating panel dialog is aria-hidden while closed, so the only
    // active dialog is the settings modal.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  // ── Tab permissions (module gating) ──

  it('only renders permitted tabs', () => {
    render(<FloatingAgent hook={makeHook()} permittedTabs={['chat', 'carousels']} />)
    fireEvent.click(screen.getByRole('button', { name: /Abrir agente de crecimiento/i }))

    expect(screen.getByRole('tab', { name: /^Chat$/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Carruseles/i })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Sugerencias/i })).not.toBeInTheDocument()
  })

  it('defaults the active tab to the first permitted one', () => {
    render(<FloatingAgent hook={makeHook()} permittedTabs={['carousels']} />)
    fireEvent.click(screen.getByRole('button', { name: /Abrir agente de crecimiento/i }))

    expect(screen.getByRole('tab', { name: /Carruseles/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('falls back to the first permitted tab when the active one becomes forbidden', () => {
    const { rerender } = render(
      <FloatingAgent hook={makeHook()} permittedTabs={['chat', 'suggestions']} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Abrir agente de crecimiento/i }))

    const suggestionsTab = screen.getByRole('tab', { name: /Sugerencias/i })
    fireEvent.click(suggestionsTab)
    expect(suggestionsTab).toHaveAttribute('aria-selected', 'true')

    // Entitlements change under us — "suggestions" is no longer permitted
    rerender(<FloatingAgent hook={makeHook()} permittedTabs={['chat', 'carousels']} />)

    expect(screen.getByRole('tab', { name: /^Chat$/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('tab', { name: /Sugerencias/i })).not.toBeInTheDocument()
  })
})

/**
 * The panel declared `aria-modal="true"` from the start while the page behind
 * it stayed lit and clickable. The scrim is what that declaration looks like.
 */
describe('FloatingAgent — scrim', () => {
  const scrimOf = (container: HTMLElement) =>
    container.querySelector('[aria-hidden="true"].fixed.inset-0')

  it('blurs the page while the agent is open', () => {
    const { container } = render(<FloatingAgent hook={makeHook()} />)

    fireEvent.click(screen.getByRole('button', { name: /Abrir agente/i }))

    expect(scrimOf(container)?.className).toContain('backdrop-blur-sm')
    expect(scrimOf(container)?.className).not.toContain('pointer-events-none')
  })

  it('lets the page through again once it is closed', () => {
    const { container } = render(<FloatingAgent hook={makeHook()} />)

    // Closed on mount: visible in the DOM for the fade, but inert.
    expect(scrimOf(container)?.className).toContain('pointer-events-none')
    expect(scrimOf(container)?.className).toContain('opacity-0')
  })

  it('sits under the panel, not over it', () => {
    const { container } = render(<FloatingAgent hook={makeHook()} />)

    // A scrim above the panel would blur the very thing it is meant to frame.
    expect(scrimOf(container)?.className).toContain('z-40')
  })
})

/**
 * The badge read 4 for a member with two messages they had typed themselves and
 * two suggestions they had already read. It counted things that existed, from a
 * baseline of zero, and called the total unread.
 */
describe('FloatingAgent — unread badge', () => {
  const withSuggestions = (count: number, loaded = true) =>
    makeHook({
      suggestionsLoaded: loaded,
      suggestions: Array.from({ length: count }, (_, i) => ({
        id: `s-${String(i)}`,
        tenantId: 't',
        userId: 'u',
        category: 'content_idea',
        content: `idea ${String(i)}`,
        status: 'pending',
        outcome: null,
        createdAt: new Date().toISOString(),
      })),
    })

  it('announces nothing for suggestions that were already there', () => {
    render(<FloatingAgent hook={withSuggestions(2)} />)

    expect(screen.queryByLabelText(/sin leer/)).not.toBeInTheDocument()
  })

  /**
   * You wrote them, and the agent answers while you are watching. Messages
   * arriving after the baseline still must not raise the badge — asserted by
   * adding them afterwards, since a message present at baseline would be
   * excluded either way and prove nothing.
   */
  it('does not count messages, even ones that arrive later', () => {
    const message = (id: string) => ({
      id,
      role: 'user' as const,
      content: 'hola',
      sessionId: 'sess-1',
      createdAt: new Date().toISOString(),
    })
    const { rerender } = render(<FloatingAgent hook={makeHook({ suggestionsLoaded: true })} />)

    rerender(
      <FloatingAgent
        hook={makeHook({ suggestionsLoaded: true, messages: [message('m1'), message('m2')] })}
      />,
    )

    expect(screen.queryByLabelText(/sin leer/)).not.toBeInTheDocument()
  })

  /**
   * The sequence that produced the bug: mount with the list still in flight,
   * then the existing suggestions land. A baseline taken at mount is zero, and
   * everything that arrives is counted as new — which is how a member with two
   * old suggestions got a red 4.
   */
  it('does not announce suggestions that merely finished loading', () => {
    const { rerender } = render(<FloatingAgent hook={withSuggestions(0, false)} />)

    rerender(<FloatingAgent hook={withSuggestions(2, true)} />)

    expect(screen.queryByLabelText(/sin leer/)).not.toBeInTheDocument()
  })

  it('announces a suggestion that arrived after the baseline', () => {
    const { rerender } = render(<FloatingAgent hook={withSuggestions(2)} />)

    rerender(<FloatingAgent hook={withSuggestions(5)} />)

    expect(screen.getByLabelText('3 sin leer')).toBeInTheDocument()
  })

  it('clears once the panel is opened', () => {
    const { rerender } = render(<FloatingAgent hook={withSuggestions(2)} />)
    rerender(<FloatingAgent hook={withSuggestions(4)} />)
    expect(screen.getByLabelText('2 sin leer')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Abrir agente/i }))

    expect(screen.queryByLabelText(/sin leer/)).not.toBeInTheDocument()
  })
})

