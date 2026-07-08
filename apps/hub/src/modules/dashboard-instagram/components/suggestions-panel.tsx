'use client'

import type { JSX } from 'react'
import { useState } from 'react'

import { Button } from '@core/ui'
import { Trash2, Sparkles } from 'lucide-react'

import type { ContentSuggestion, SuggestionBatch } from '../types/instagram.types'
import { SuggestionCard } from './suggestion-card'
import { GenerateSuggestionModal } from './generate-suggestion-modal'

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `hace ${days} día${days !== 1 ? 's' : ''}`
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsModalOpen(true)}
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

      {/* Content */}
      <div className="p-4">
        {!hasSuggestions ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No hay sugerencias aún. Comenzá una conversación para obtener ideas.
          </p>
        ) : hasBatches ? (
          /* Grouped by batch */
          <div className="space-y-5">
            {suggestionBatches!.map((batch) => (
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
        onClose={() => setIsModalOpen(false)}
        onGenerated={onRefreshSuggestions}
      />
    )}
    </>
  )
}
