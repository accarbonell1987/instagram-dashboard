'use client'

import type { JSX } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@core/ui'
import { Check, X, Clock, Hash, Lightbulb, Zap, PenLine, Layers, Sparkles } from 'lucide-react'
import type { ContentSuggestion, SuggestionCategory } from '../types/instagram.types'
import { MarkdownRenderer } from './markdown-renderer'

const categoryMeta: Record<SuggestionCategory, { label: string; icon: LucideIcon; colors: string }> = {
  caption:      { label: 'Caption',          icon: PenLine,     colors: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  format:       { label: 'Formato',          icon: Layers,      colors: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  posting_time: { label: 'Horario',          icon: Clock,       colors: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  hook:         { label: 'Hook',             icon: Zap,         colors: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' },
  hashtags:     { label: 'Hashtags',         icon: Hash,        colors: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  content_idea: { label: 'Idea de contenido', icon: Lightbulb,  colors: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
}

export interface SuggestionCardProps {
  suggestion: ContentSuggestion
  onMarkUsed: (id: string) => void
  onDismiss: (id: string) => void
  onStartCarousel?: (suggestion: ContentSuggestion) => void
  isActing?: boolean
}

export function SuggestionCard({
  suggestion,
  onMarkUsed,
  onDismiss,
  onStartCarousel,
  isActing = false,
}: SuggestionCardProps): JSX.Element {
  const meta = categoryMeta[suggestion.category]
  const Icon = meta.icon

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2.5 shadow-sm">
      {/* Category badge with icon */}
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.colors}`}>
        <Icon className="h-3 w-3" aria-hidden="true" />
        {meta.label}
      </span>

      {/* Content */}
      <MarkdownRenderer content={suggestion.content} />

      {/* Actions: primary actions left, dismiss right */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center gap-1.5">
          {suggestion.category === 'content_idea' && onStartCarousel ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => onStartCarousel(suggestion)}
              disabled={isActing}
              className="h-7 px-2.5 text-xs gap-1.5"
              aria-label="Crear carrusel con esta idea"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Crear carrusel
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => onMarkUsed(suggestion.id)}
              disabled={isActing}
              className="h-7 px-2.5 text-xs gap-1.5"
              aria-label="Marcar como usada"
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Usar
            </Button>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDismiss(suggestion.id)}
          disabled={isActing}
          className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Descartar sugerencia"
          title="Descartar"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
