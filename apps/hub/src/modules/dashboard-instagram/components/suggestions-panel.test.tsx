import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SuggestionsPanel } from './suggestions-panel'
import type { ContentSuggestion } from '../types/instagram.types'

const makeSuggestion = (id: string, overrides: Partial<ContentSuggestion> = {}): ContentSuggestion => ({
  id,
  category: 'caption',
  content: `Suggestion ${id}`,
  status: 'pending',
  outcome: null,
  createdAt: new Date().toISOString(),
  ...overrides,
})

describe('SuggestionsPanel', () => {
  it('renders cards for each suggestion', () => {
    const suggestions = [
      makeSuggestion('s1', { content: 'First suggestion' }),
      makeSuggestion('s2', { content: 'Second suggestion' }),
    ]
    render(
      <SuggestionsPanel
        suggestions={suggestions}
        onMarkUsed={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )

    expect(screen.getByText('First suggestion')).toBeInTheDocument()
    expect(screen.getByText('Second suggestion')).toBeInTheDocument()
  })

  it('clicking "Usar" calls onMarkUsed with suggestion id', () => {
    const onMarkUsed = vi.fn()
    const suggestions = [makeSuggestion('s1', { content: 'Suggestion to use' })]
    render(
      <SuggestionsPanel
        suggestions={suggestions}
        onMarkUsed={onMarkUsed}
        onDismiss={vi.fn()}
      />,
    )

    const usarButtons = screen.getAllByRole('button', { name: /Marcar como usada/i })
    fireEvent.click(usarButtons[0]!)

    expect(onMarkUsed).toHaveBeenCalledWith('s1')
  })

  it('clicking "Descartar" calls onDismiss with suggestion id', () => {
    const onDismiss = vi.fn()
    const suggestions = [makeSuggestion('s2', { content: 'Suggestion to dismiss' })]
    render(
      <SuggestionsPanel
        suggestions={suggestions}
        onMarkUsed={vi.fn()}
        onDismiss={onDismiss}
      />,
    )

    const descartarButtons = screen.getAllByRole('button', { name: /Descartar sugerencia/i })
    fireEvent.click(descartarButtons[0]!)

    expect(onDismiss).toHaveBeenCalledWith('s2')
  })

  it('shows empty state message when suggestions = []', () => {
    render(
      <SuggestionsPanel suggestions={[]} onMarkUsed={vi.fn()} onDismiss={vi.fn()} />,
    )

    expect(
      screen.getByText(/No hay sugerencias aún/i),
    ).toBeInTheDocument()
  })

  it('shows suggestion count in header when suggestions exist', () => {
    const suggestions = [makeSuggestion('s1'), makeSuggestion('s2'), makeSuggestion('s3')]
    render(
      <SuggestionsPanel suggestions={suggestions} onMarkUsed={vi.fn()} onDismiss={vi.fn()} />,
    )

    expect(screen.getByText(/3 sugerencias/i)).toBeInTheDocument()
  })
})
