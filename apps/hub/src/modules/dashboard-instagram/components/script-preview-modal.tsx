'use client'

import type { JSX } from 'react'
import { useState, useEffect } from 'react'
import { Button, Label, Textarea } from '@core/ui'
import { RefreshCw, X, Sparkles } from 'lucide-react'
import type { AgentLimits, GeneratedSlide, SlideRole } from '../types/instagram.types'
import { previewCarouselScript, createCarousel } from '../services/instagram.service'

interface ScriptPreviewModalProps {
  topic: string
  suggestionId?: string
  limits?: AgentLimits | undefined
  onClose: () => void
  onCreated: (carouselId: string) => void
}

const ROLE_LABELS: Record<SlideRole, string> = {
  hook: 'Gancho',
  development: 'Desarrollo',
  cta: 'CTA',
  default: 'Slide',
}

const ROLE_COLORS: Record<SlideRole, string> = {
  hook: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  development: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  cta: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  default: 'bg-muted text-muted-foreground',
}

export function ScriptPreviewModal({
  topic: initialTopic,
  suggestionId,
  limits,
  onClose,
  onCreated,
}: ScriptPreviewModalProps): JSX.Element {
  const slideTextMax = limits?.slideText ?? 150
  const visualPromptMax = limits?.visualPrompt ?? 300
  const [topic, setTopic] = useState(initialTopic)
  const [slides, setSlides] = useState<GeneratedSlide[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPreview = async (t: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await previewCarouselScript(t)
      setSlides(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar el guión')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadPreview(initialTopic)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateSlide = (index: number, field: 'text' | 'visualPrompt', value: string) => {
    setSlides((prev) =>
      prev ? prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)) : prev,
    )
  }

  const handleRegenerate = () => void loadPreview(topic)

  const handleCreate = async () => {
    if (!slides) return
    setIsCreating(true)
    setError(null)
    try {
      const result = await createCarousel(topic, suggestionId, slides)
      onCreated(result.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el carrusel')
      setIsCreating(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Revisar guión del carrusel"
    >
      <div className="bg-background border rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div>
            <h2 className="font-semibold text-sm">Revisar guión</h2>
            <p className="text-xs text-muted-foreground">
              Editá el texto y los prompts antes de generar las imágenes
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={isCreating}
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Topic */}
          <div>
            <Label className="text-xs text-muted-foreground block mb-1" htmlFor="preview-topic">
              Tema
            </Label>
            <div className="flex gap-2">
              <Textarea
                id="preview-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={2}
                maxLength={2000}
                disabled={isLoading || isCreating}
                className="flex-1 resize-none disabled:opacity-50"
                placeholder="¿Sobre qué trata este carrusel?"
              />
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 self-end"
                onClick={handleRegenerate}
                disabled={isLoading || isCreating || !topic.trim()}
                aria-label="Regenerar guión"
                title="Regenerar con este tema"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              </Button>
            </div>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Generando guión con IA...</p>
            </div>
          )}

          {/* Slides */}
          {!isLoading && slides && slides.map((slide, index) => (
            <div key={slide.order} className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Slide {index + 1}
                </span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ROLE_COLORS[slide.role]}`}>
                  {ROLE_LABELS[slide.role]}
                </span>
              </div>

              {/* Slide text */}
              <div>
                <Label
                  className="text-[10px] text-muted-foreground block mb-1 uppercase tracking-wide"
                  htmlFor={`slide-text-${String(index)}`}
                >
                  Texto (español)
                </Label>
                <Textarea
                  id={`slide-text-${String(index)}`}
                  value={slide.text}
                  onChange={(e) => updateSlide(index, 'text', e.target.value)}
                  rows={2}
                  maxLength={slideTextMax}
                  disabled={isCreating}
                  className="resize-none disabled:opacity-50"
                />
                <p className="text-[10px] text-muted-foreground text-right">{slide.text.length}/{slideTextMax}</p>
              </div>

              {/* Visual prompt */}
              <div>
                <Label
                  className="text-[10px] text-muted-foreground block mb-1 uppercase tracking-wide"
                  htmlFor={`slide-prompt-${String(index)}`}
                >
                  Prompt visual (inglés, para fal.ai)
                </Label>
                <Textarea
                  id={`slide-prompt-${String(index)}`}
                  value={slide.visualPrompt}
                  onChange={(e) => updateSlide(index, 'visualPrompt', e.target.value)}
                  rows={2}
                  maxLength={visualPromptMax}
                  disabled={isCreating}
                  className="resize-none disabled:opacity-50 font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground text-right">{slide.visualPrompt.length}/{visualPromptMax}</p>
              </div>
            </div>
          ))}

          {error && (
            <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3 border-t shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onClose}
            disabled={isCreating}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => void handleCreate()}
            disabled={isLoading || isCreating || !slides || slides.length === 0}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {isCreating ? 'Creando...' : 'Generar imágenes'}
          </Button>
        </div>
      </div>
    </div>
  )
}
