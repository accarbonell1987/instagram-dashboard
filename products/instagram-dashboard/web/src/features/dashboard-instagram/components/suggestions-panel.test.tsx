import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import type { ContentSuggestion } from '../types/instagram.types'

import { SuggestionsPanel } from './suggestions-panel'


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

  it('clicking "Hecha" calls onMarkUsed with suggestion id', () => {
    const onMarkUsed = vi.fn()
    const suggestions = [makeSuggestion('s1', { content: 'Suggestion to use' })]
    render(
      <SuggestionsPanel
        suggestions={suggestions}
        onMarkUsed={onMarkUsed}
        onDismiss={vi.fn()}
      />,
    )

    const doneButtons = screen.getAllByRole('button', { name: /Marcar como hecha/i })
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- getAllByRole guarantees at least one match here
    fireEvent.click(doneButtons[0]!)

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
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- getAllByRole guarantees at least one match here
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

  /**
   * "Usar" was renamed to "Hecha" because it never did what its name promised.
   * The help exists so the panel says that out loud instead of leaving people
   * to guess what an action does — which is how the question came up.
   */
  describe('help', () => {
    const openHelp = () => {
      render(
        <SuggestionsPanel suggestions={[]} onMarkUsed={vi.fn()} onDismiss={vi.fn()} />,
      )
      fireEvent.click(screen.getByRole('button', { name: /Qué hace cada botón/i }))
    }

    it('stays out of the way until asked for', () => {
      render(<SuggestionsPanel suggestions={[]} onMarkUsed={vi.fn()} onDismiss={vi.fn()} />)

      expect(screen.queryByText(/la sacás de pendientes/i)).not.toBeInTheDocument()
    })

    it('explains each of the three actions', () => {
      openHelp()

      expect(screen.getByText('Hecha')).toBeInTheDocument()
      expect(screen.getByText('Crear carrusel')).toBeInTheDocument()
      expect(screen.getByText('Descartar')).toBeInTheDocument()
    })

    /**
     * The part worth writing down: the button records that you used the idea and
     * nothing more. Saying so beats letting someone assume results are measured.
     */
    it('says plainly that marking it done links nothing', () => {
      openHelp()

      expect(screen.getByText(/no se vincula/i)).toBeInTheDocument()
    })

    it('closes again', () => {
      openHelp()
      fireEvent.click(screen.getByRole('button', { name: /Qué hace cada botón/i }))

      expect(screen.queryByText(/no se vincula/i)).not.toBeInTheDocument()
    })
  })
})

