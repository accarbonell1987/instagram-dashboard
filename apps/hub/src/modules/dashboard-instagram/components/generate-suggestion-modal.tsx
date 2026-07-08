'use client'

import type { JSX } from 'react'
import { useState } from 'react'
import { Button, Label, Textarea } from '@core/ui'
import { Sparkles, X } from 'lucide-react'
import { generateContentSuggestion } from '../services/instagram.service'

interface GenerateSuggestionModalProps {
  onClose: () => void
  onGenerated: () => Promise<void>
}

export function GenerateSuggestionModal({ onClose, onGenerated }: GenerateSuggestionModalProps): JSX.Element {
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setIsGenerating(true)
    setError(null)
    try {
      await generateContentSuggestion(prompt.trim())
      await onGenerated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar la idea')
      setIsGenerating(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Generar idea de contenido"
    >
      <div className="bg-background border rounded-xl shadow-xl w-full max-w-sm flex flex-col gap-4 p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold text-sm flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-violet-500" aria-hidden="true" />
              Generar idea de contenido
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Describí qué tipo de idea querés y la IA la generará para vos
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={isGenerating}
            className="shrink-0 -mt-0.5"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Prompt input */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground" htmlFor="idea-prompt">
            ¿Sobre qué querés generar la idea?
          </Label>
          <Textarea
            id="idea-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleGenerate()
            }}
            rows={3}
            maxLength={500}
            disabled={isGenerating}
            placeholder="Ej: recetas saludables para el desayuno, tendencias de moda primavera..."
            className="rounded-lg p-3 resize-none disabled:opacity-50"
            autoFocus
          />
          <p className="text-[10px] text-muted-foreground text-right">{prompt.length}/500</p>
        </div>

        {error && (
          <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">{error}</p>
        )}

        {/* Footer */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose} disabled={isGenerating}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => void handleGenerate()}
            disabled={isGenerating || !prompt.trim()}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {isGenerating ? 'Generando...' : 'Generar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
