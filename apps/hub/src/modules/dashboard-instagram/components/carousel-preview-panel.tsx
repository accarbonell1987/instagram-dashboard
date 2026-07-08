'use client'

import type { JSX } from 'react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Button, Label, Textarea } from '@core/ui'
import { ChevronLeft, ChevronRight, RefreshCw, X, ExternalLink, AlertCircle, AlertTriangle, ImageOff } from 'lucide-react'
import type { Carousel, CarouselSlide } from '../types/instagram.types'
import {
  getCarousel,
  updateCarouselSlide,
  regenerateCarouselSlide,
  reorderCarouselSlides,
  resolveImageUrl,
} from '../services/instagram.service'
import { RedoPromptPanel } from './redo-prompt-panel'
import { PublishConfirmDialog } from './publish-confirm-dialog'

const INITIAL_POLL_MS = 1_000
const MAX_POLL_MS = 8_000
const TERMINAL_STATUSES = new Set(['ready', 'failed'])

interface CarouselPreviewPanelProps {
  carouselId: string
  onClose: () => void
}

function SlideImage({ slide }: { slide: CarouselSlide }): JSX.Element {
  if (slide.status === 'generating') {
    return (
      <div className="w-full aspect-[4/5] bg-muted rounded-lg flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">Generando imagen...</p>
        </div>
      </div>
    )
  }

  if (slide.status === 'failed') {
    return (
      <div className="w-full aspect-[4/5] bg-destructive/5 rounded-lg flex flex-col items-center justify-center border border-dashed border-destructive/30 gap-2">
        <AlertCircle className="h-5 w-5 text-destructive/60" aria-hidden="true" />
        <p className="text-xs text-destructive/70">Error al generar imagen</p>
      </div>
    )
  }

  if (!slide.imageUrl) {
    return (
      <div className="w-full aspect-[4/5] bg-muted/50 rounded-lg flex flex-col items-center justify-center border border-dashed border-muted-foreground/30 gap-2">
        <ImageOff className="h-5 w-5 text-muted-foreground/50" aria-hidden="true" />
        <p className="text-xs text-muted-foreground">Sin imagen</p>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolveImageUrl(slide.imageUrl)}
      alt={`Slide ${String(slide.order)}`}
      className="w-full aspect-[4/5] object-cover rounded-lg"
    />
  )
}

interface EditableTextProps {
  slide: CarouselSlide
  onSave: (text: string) => Promise<void>
}

function EditableText({ slide, onSave }: EditableTextProps): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(slide.text)
  const [saving, setSaving] = useState(false)

  const handleBlur = async () => {
    if (value.trim() === slide.text) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSave(value.trim())
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void handleBlur()}
        maxLength={150}
        rows={3}
        disabled={saving}
        autoFocus
        className="resize-none"
        aria-label="Editar texto del slide"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="w-full text-left text-sm p-2 rounded hover:bg-muted/50 transition-colors cursor-text"
      title="Clic para editar"
      aria-label="Editar texto del slide"
    >
      {slide.text || <span className="text-muted-foreground italic">Sin texto</span>}
    </button>
  )
}

export function CarouselPreviewPanel({ carouselId, onClose }: CarouselPreviewPanelProps): JSX.Element {
  const [carousel, setCarousel] = useState<Carousel | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isRegenerating, setIsRegenerating] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [showRedoPanel, setShowRedoPanel] = useState(false)
  const [showPublishDialog, setShowPublishDialog] = useState(false)

  // Polling with exponential backoff via setTimeout (not setInterval)
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollDelayRef = useRef(INITIAL_POLL_MS)
  const isMountedRef = useRef(true)
  const captionInitializedRef = useRef(false)

  const clearPoll = useCallback(() => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const fetchAndSchedule = useCallback(async () => {
    try {
      const data = await getCarousel(carouselId)
      if (!isMountedRef.current) return
      setCarousel(data)

      if (TERMINAL_STATUSES.has(data.status)) {
        pollDelayRef.current = INITIAL_POLL_MS
        return
      }

      // Schedule next poll — double the delay up to the max
      const nextDelay = pollDelayRef.current
      pollDelayRef.current = Math.min(pollDelayRef.current * 2, MAX_POLL_MS)
      pollingRef.current = setTimeout(() => { void fetchAndSchedule() }, nextDelay)
    } catch {
      if (!isMountedRef.current) return
      // Retry with current delay on transient network errors
      pollingRef.current = setTimeout(() => { void fetchAndSchedule() }, pollDelayRef.current)
    }
  }, [carouselId])

  // Restart polling from the beginning (used after regenerate actions)
  const restartPolling = useCallback(() => {
    clearPoll()
    pollDelayRef.current = INITIAL_POLL_MS
    void fetchAndSchedule()
  }, [clearPoll, fetchAndSchedule])

  useEffect(() => {
    isMountedRef.current = true
    void fetchAndSchedule()
    return () => {
      isMountedRef.current = false
      clearPoll()
    }
  }, [fetchAndSchedule, clearPoll])

  // Initialize caption once when carousel first reaches ready status
  useEffect(() => {
    if (carousel?.status === 'ready' && !captionInitializedRef.current) {
      captionInitializedRef.current = true
      const hookSlide = carousel.slides.find((s) => s.role === 'hook')
      setCaption(carousel.caption ?? hookSlide?.text ?? '')
    }
  }, [carousel])

  const slides = carousel?.slides ?? []
  const currentSlide = slides[currentIndex]

  const handleSaveText = async (slideId: string, text: string) => {
    const updated = await updateCarouselSlide(carouselId, slideId, { text })
    setCarousel((prev) => {
      if (!prev) return prev
      return { ...prev, slides: prev.slides.map((s) => (s.id === slideId ? updated : s)) }
    })
  }

  const handleRegenerate = async (slideId: string) => {
    setIsRegenerating(slideId)
    try {
      await regenerateCarouselSlide(carouselId, slideId)
      restartPolling()
    } finally {
      setIsRegenerating(null)
    }
  }

  const handleMoveSlide = async (fromIndex: number, direction: 'up' | 'down') => {
    if (!carousel) return
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1
    if (toIndex < 0 || toIndex >= slides.length) return

    const newSlides = [...slides]
    const [moved] = newSlides.splice(fromIndex, 1)
    if (!moved) return
    newSlides.splice(toIndex, 0, moved)

    const reordered = newSlides.map((s, i) => ({ ...s, order: i + 1 }))
    setCarousel({ ...carousel, slides: reordered })
    setCurrentIndex(toIndex)

    await reorderCarouselSlides(
      carouselId,
      reordered.map((s) => ({ id: s.id, order: s.order })),
    )
  }

  const handleRedoRegenerated = () => {
    setShowRedoPanel(false)
    captionInitializedRef.current = false // re-initialize caption after regen
    restartPolling()
  }

  const handlePublishSuccess = (permalink: string) => {
    setCarousel((prev) =>
      prev ? { ...prev, publishStatus: 'published', igPermalink: permalink } : prev,
    )
  }

  const statusLabel: Record<string, string> = {
    pending: 'Preparando...',
    generating_script: 'Generando guión...',
    generating_images: 'Generando imágenes...',
    ready: 'Listo',
    failed: 'Error en la generación',
  }

  const isReady = carousel?.status === 'ready'
  const isFailed = carousel?.status === 'failed'
  const isUnpublished = carousel?.publishStatus === 'unpublished'
  const isPublished = carousel?.publishStatus === 'published'
  const allSlidesHaveImages = slides.length > 0 && slides.every((s) => s.imageUrl !== null)
  const canPublish = isReady && !isPublished && allSlidesHaveImages

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Previsualización de carrusel"
      >
        <div className="bg-background border rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
            <div>
              <h2 className="font-semibold text-sm">Carrusel</h2>
              {carousel && (
                <p className={`text-xs ${isFailed ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {statusLabel[carousel.status] ?? carousel.status}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isPublished && (
                <span className="text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                  Publicado
                </span>
              )}
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar panel">
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          {/* Slide stepper with inline navigation arrows */}
          {slides.length > 0 && (
            <div className="px-3 py-1.5 border-b shrink-0 flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={slides.length <= 1 || currentIndex === 0}
                aria-label="Slide anterior"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>

              <div className="flex flex-1 justify-center gap-1">
                {slides.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setCurrentIndex(i)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i === currentIndex
                        ? 'bg-primary'
                        : s.status === 'failed' || (!s.imageUrl && s.status === 'ready')
                          ? 'bg-destructive/50'
                          : 'bg-muted-foreground/30'
                    }`}
                    aria-label={`Ir al slide ${String(i + 1)}`}
                  />
                ))}
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => setCurrentIndex((i) => Math.min(slides.length - 1, i + 1))}
                disabled={slides.length <= 1 || currentIndex === slides.length - 1}
                aria-label="Siguiente slide"
              >
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>

              <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                {currentIndex + 1}/{slides.length}
              </span>
            </div>
          )}

          {/* Main content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!carousel ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              </div>
            ) : slides.length === 0 && !isFailed ? (
              <div className="text-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Generando guión...</p>
              </div>
            ) : (
              <>
                {/* Generation failed banner */}
                {isFailed && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 space-y-2">
                    <div className="flex gap-2 items-start">
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-medium text-destructive">Error en la generación</p>
                        {carousel.errorMessage && (
                          <p className="text-xs text-destructive/80 mt-0.5">{carousel.errorMessage}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
                      onClick={() => setShowRedoPanel(true)}
                    >
                      Reintentar con nuevo prompt
                    </Button>
                  </div>
                )}

                {/* Missing images warning */}
                {isReady && !allSlidesHaveImages && slides.length > 0 && (
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
                    <div className="flex gap-2 items-start">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Faltan imágenes</p>
                        <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-0.5">
                          Algunos slides no tienen imagen. Regenera las imágenes faltantes antes de publicar.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Current slide content */}
                {currentSlide && (
                  <>
                    <SlideImage slide={currentSlide} />

                    <div>
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {currentSlide.role}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Texto del slide</p>
                      <EditableText
                        slide={currentSlide}
                        onSave={(text) => handleSaveText(currentSlide.id, text)}
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => void handleRegenerate(currentSlide.id)}
                        disabled={isRegenerating === currentSlide.id || currentSlide.status === 'generating'}
                        aria-label="Regenerar imagen"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 mr-1.5 ${isRegenerating === currentSlide.id ? 'animate-spin' : ''}`}
                          aria-hidden="true"
                        />
                        Regenerar imagen
                      </Button>
                    </div>

                    {slides.length > 1 && (
                      <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-1.5">
                        <span className="text-xs text-muted-foreground">Reordenar</span>
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => void handleMoveSlide(currentIndex, 'up')}
                            disabled={currentIndex === 0}
                            aria-label="Mover slide antes"
                            title="Mover antes"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                          <span className="text-xs font-medium w-10 text-center tabular-nums">
                            {currentIndex + 1}/{slides.length}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => void handleMoveSlide(currentIndex, 'down')}
                            disabled={currentIndex === slides.length - 1}
                            aria-label="Mover slide después"
                            title="Mover después"
                          >
                            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Caption — visible when ready */}
                    {isReady && (
                      <div className="border-t pt-3">
                        <Label className="text-xs text-muted-foreground block mb-1" htmlFor="carousel-caption">
                          Caption de Instagram
                        </Label>
                        <Textarea
                          id="carousel-caption"
                          value={caption}
                          onChange={(e) => setCaption(e.target.value)}
                          rows={3}
                          maxLength={2200}
                          disabled={isPublished}
                          className="resize-none disabled:opacity-50"
                          placeholder="Escribe el caption para Instagram..."
                        />
                        <p className="text-[10px] text-muted-foreground text-right mt-0.5">
                          {caption.length} / 2200
                        </p>
                      </div>
                    )}

                  </>
                )}
              </>
            )}
          </div>

          {/* Publish / Redo — sticky footer, visible when ready and not yet successfully published */}
          {isReady && !isPublished && (
            <div className="flex flex-col gap-2 px-4 py-3 border-t shrink-0 bg-background">
              {carousel?.publishStatus === 'failed' && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                  El intento anterior falló. Podés reintentar.
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setShowRedoPanel(true)}
                >
                  Rehacer
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => setShowPublishDialog(true)}
                  disabled={!canPublish}
                  title={!allSlidesHaveImages ? 'Regenera las imágenes faltantes antes de publicar' : undefined}
                >
                  Publicar
                </Button>
              </div>
            </div>
          )}

          {/* Published link — sticky footer when already published */}
          {isPublished && carousel?.igPermalink && (
            <div className="flex items-center justify-center px-4 py-3 border-t shrink-0 bg-background">
              <a
                href={carousel.igPermalink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                Ver en Instagram
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          )}
        </div>
      </div>

      {showRedoPanel && carousel && (
        <RedoPromptPanel
          carousel={carousel}
          onClose={() => setShowRedoPanel(false)}
          onRegenerated={handleRedoRegenerated}
        />
      )}

      {showPublishDialog && (
        <PublishConfirmDialog
          carouselId={carouselId}
          caption={caption}
          onClose={() => setShowPublishDialog(false)}
          onSuccess={handlePublishSuccess}
        />
      )}
    </>
  )
}
