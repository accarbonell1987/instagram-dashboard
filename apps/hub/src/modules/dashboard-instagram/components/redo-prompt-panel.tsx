'use client'

import type { JSX } from 'react'
import { useState } from 'react'
import { Button, Label, Textarea } from '@core/ui'
import { X } from 'lucide-react'
import type { Carousel } from '../types/instagram.types'
import { updateCarouselSlide, regenerateCarousel } from '../services/instagram.service'

interface RedoPromptPanelProps {
  carousel: Carousel
  onClose: () => void
  onRegenerated: () => void
}

export function RedoPromptPanel({ carousel, onClose, onRegenerated }: RedoPromptPanelProps): JSX.Element {
  const [topic, setTopic] = useState(carousel.topic)
  const [slidePrompts, setSlidePrompts] = useState<Record<string, string>>(
    Object.fromEntries(carousel.slides.map((s) => [s.id, s.visualPrompt])),
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRegenerate = async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      // Save edited visual prompts for each slide that changed
      await Promise.all(
        carousel.slides
          .filter((s) => slidePrompts[s.id] !== s.visualPrompt)
          .map((s) =>
            updateCarouselSlide(carousel.id, s.id, { visualPrompt: slidePrompts[s.id] ?? s.visualPrompt }),
          ),
      )
      await regenerateCarousel(carousel.id, topic !== carousel.topic ? topic : undefined)
      onRegenerated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al regenerar')
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Regenerar carrusel"
    >
      <div className="bg-background border rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <h2 className="font-semibold text-sm">Rehacer carrusel</h2>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={isSubmitting} aria-label="Cerrar">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Topic */}
          <div>
            <Label className="text-xs text-muted-foreground block mb-1" htmlFor="redo-topic">
              Tema del carrusel
            </Label>
            <Textarea
              id="redo-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={2}
              maxLength={500}
              disabled={isSubmitting}
              className="resize-none disabled:opacity-50"
              placeholder="¿Sobre qué trata este carrusel?"
            />
          </div>

          {/* Per-slide visual prompts */}
          {carousel.slides.map((slide, index) => (
            <div key={slide.id}>
              <Label
                className="text-xs text-muted-foreground block mb-1"
                htmlFor={`redo-prompt-${slide.id}`}
              >
                Slide {index + 1} — prompt visual
                <span className="ml-1 text-muted-foreground/60 capitalize">({slide.role})</span>
              </Label>
              <Textarea
                id={`redo-prompt-${slide.id}`}
                value={slidePrompts[slide.id] ?? slide.visualPrompt}
                onChange={(e) =>
                  setSlidePrompts((prev) => ({ ...prev, [slide.id]: e.target.value }))
                }
                rows={2}
                maxLength={300}
                disabled={isSubmitting}
                className="resize-none disabled:opacity-50"
                placeholder="Describe la imagen para este slide..."
              />
            </div>
          ))}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3 border-t shrink-0">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={() => void handleRegenerate()}
            disabled={isSubmitting || !topic.trim()}
          >
            {isSubmitting ? 'Regenerando...' : 'Regenerar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
