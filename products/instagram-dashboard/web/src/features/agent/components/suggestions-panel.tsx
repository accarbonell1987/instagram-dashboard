'use client'

import { Button } from '@core/ui'
import { Trash2, Sparkles, HelpCircle, Check, X } from 'lucide-react'
import type { JSX } from 'react'
import { useState } from 'react'



import { GenerateSuggestionModal } from '@/features/agent/components/generate-suggestion-modal'
import { SuggestionCard } from '@/features/agent/components/suggestion-card'
import type { ContentSuggestion, SuggestionBatch } from '@/features/shared/types/instagram.types'

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${String(mins)} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${String(hours)} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `hace ${String(days)} día${days !== 1 ? 's' : ''}`
  return date.toLocaleDateString('es-AR')
}

interface SuggestionsPanelProps {
  suggestions: ContentSuggestion[]
  suggestionBatches?: SuggestionBatch[]
  onMarkUsed: (id: string) => void
  onDismiss: (id: string) => void
  onClearAll?: () => void
  onStartCarousel?: (suggestion: ContentSuggestion) => void
  onRefreshSuggestions?: () => Promise<void>
}

export function SuggestionsPanel({
  suggestions,
  suggestionBatches,
  onMarkUsed,
  onDismiss,
  onClearAll,
  onStartCarousel,
  onRefreshSuggestions,
}: SuggestionsPanelProps): JSX.Element {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const hasBatches = suggestionBatches && suggestionBatches.length > 0
  const hasSuggestions = suggestions.length > 0

  return (
    <>
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-sm">Sugerencias</h3>
            <p className="text-xs text-muted-foreground">
              {hasSuggestions
                ? `${String(suggestions.length)} sugerencia${suggestions.length !== 1 ? 's' : ''}`
                : 'Sin sugerencias pendientes'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {/*
              Inline, not a Popover. This panel is a hand-rolled fixed element
              rather than a Dialog, and a Radix portal inside it is the
              z-index fight the Select already lost here once.
            */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setShowHelp((open) => !open); }}
              className="text-muted-foreground shrink-0"
              title="Qué hace cada botón"
              aria-label="Qué hace cada botón"
              aria-expanded={showHelp}
            >
              <HelpCircle className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setIsModalOpen(true); }}
              className="text-violet-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 shrink-0"
              title="Generar idea con IA"
              aria-label="Generar idea de contenido con IA"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </Button>
            {hasSuggestions && onClearAll && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClearAll}
                className="text-muted-foreground shrink-0"
                title="Limpiar sugerencias"
                aria-label="Limpiar sugerencias"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {showHelp && (
        <div className="bg-muted/40 border-b px-4 py-3 text-xs">
          <p className="text-muted-foreground mb-2">
            El agente propone ideas a partir de las métricas de tu cuenta. Cada una tiene tres
            acciones:
          </p>
          <ul className="flex flex-col gap-2">
            <li className="flex gap-2">
              <Check className="text-foreground mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                <strong className="text-foreground">Hecha</strong> — la sacás de pendientes cuando
                ya la usaste. Es un registro tuyo: hoy{' '}
                <strong className="text-foreground">no se vincula</strong> a la publicación ni se
                mide su resultado.
              </span>
            </li>
            <li className="flex gap-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" aria-hidden="true" />
              <span>
                <strong className="text-foreground">Crear carrusel</strong> — genera el carrusel a
                partir de la idea. Aparece solo en ideas de contenido, y solo si tu rol incluye
                carruseles.
              </span>
            </li>
            <li className="flex gap-2">
              <X className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                <strong className="text-foreground">Descartar</strong> — la borrás sin usarla.
              </span>
            </li>
          </ul>
          <p className="text-muted-foreground mt-2">
            Con el botón <Sparkles className="inline h-3 w-3 text-violet-500" aria-hidden="true" />{' '}
            pedís una idea nueva sobre el tema que le indiques.
          </p>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {!hasSuggestions ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No hay sugerencias aún. Comenzá una conversación para obtener ideas.
          </p>
        ) : hasBatches ? (
          /* Grouped by batch */
          <div className="space-y-5">
            {suggestionBatches.map((batch) => (
              <div key={batch.id}>
                {/* Batch header */}
                <div className="mb-2">
                  <p className="text-xs text-muted-foreground truncate">
                    Sugerencias para:{' '}
                    <span className="font-medium text-foreground">
                      &ldquo;{batch.userMessage}&rdquo;
                    </span>
                  </p>
                  <p className="text-[10px] text-muted-foreground/70">
                    {relativeTime(batch.createdAt)} · {batch.suggestions.length} sugerencia{batch.suggestions.length !== 1 ? 's' : ''}
                  </p>
                </div>
                {/* Suggestions within batch */}
                <div className="space-y-2 pl-2 border-l-2 border-border">
                  {batch.suggestions.map((suggestion) => (
                    <SuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      onMarkUsed={onMarkUsed}
                      onDismiss={onDismiss}
                      {...(onStartCarousel !== undefined && { onStartCarousel })}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Flat list (fallback when batches not loaded) */
          <div className="space-y-3">
            {suggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onMarkUsed={onMarkUsed}
                onDismiss={onDismiss}
                {...(onStartCarousel !== undefined && { onStartCarousel })}
              />
            ))}
          </div>
        )}
      </div>
    </div>

    {isModalOpen && onRefreshSuggestions && (
      <GenerateSuggestionModal
        onClose={() => { setIsModalOpen(false); }}
        onGenerated={onRefreshSuggestions}
      />
    )}
    </>
  )
}
