'use client'

import type { JSX } from 'react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@core/ui'
import {
  LayoutGrid,
  ExternalLink,
  Trash2,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  ImageOff,
  Plus,
  Sparkles,
  Send,
  Upload,
} from 'lucide-react'
import type { AgentLimits, Carousel } from '../types/instagram.types'
import { listCarousels, deleteCarousel, resolveImageUrl } from '../services/instagram.service'
import { ScriptPreviewModal } from './script-preview-modal'
import { UploadCarouselModal } from './upload-carousel-modal'

function relativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `hace ${days} día${days !== 1 ? 's' : ''}`
  return d.toLocaleDateString('es-AR')
}

function StatusBadge({ carousel }: { carousel: Carousel }): JSX.Element {
  if (carousel.publishStatus === 'published') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
        Publicado
      </span>
    )
  }
  if (carousel.status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
        <XCircle className="h-2.5 w-2.5" aria-hidden="true" />
        Error
      </span>
    )
  }
  if (carousel.status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
        <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
        Listo
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
      <Clock className="h-2.5 w-2.5" aria-hidden="true" />
      Generando
    </span>
  )
}

function CarouselThumbnail({ carousel }: { carousel: Carousel }): JSX.Element {
  const hookSlide = carousel.slides.find((s) => s.role === 'hook') ?? carousel.slides[0]
  const imageUrl = hookSlide?.imageUrl

  if (!imageUrl) {
    return (
      <div className="w-full aspect-[4/5] bg-muted/60 rounded-md flex flex-col items-center justify-center gap-1.5 border border-dashed border-muted-foreground/20">
        {carousel.status === 'failed' ? (
          <AlertCircle className="h-5 w-5 text-destructive/50" aria-hidden="true" />
        ) : carousel.status === 'ready' ? (
          <ImageOff className="h-5 w-5 text-muted-foreground/40" aria-hidden="true" />
        ) : (
          <div className="w-5 h-5 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
        )}
        <span className="text-[10px] text-muted-foreground/60">
          {carousel.status === 'failed' ? 'Error' : carousel.status === 'ready' ? 'Sin imagen' : 'Generando...'}
        </span>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolveImageUrl(imageUrl)}
      alt={carousel.topic}
      className="w-full aspect-[4/5] object-cover rounded-md"
    />
  )
}

interface CarouselCardProps {
  carousel: Carousel
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  isDeleting: boolean
}

function CarouselActions({ carousel, onOpen, onDelete, isDeleting }: CarouselCardProps): JSX.Element {
  return (
    <>
      {carousel.status === 'ready' && carousel.publishStatus === 'unpublished' ? (
        <Button
          variant="default"
          size="sm"
          className="h-7 px-2.5 text-xs gap-1"
          onClick={() => onOpen(carousel.id)}
        >
          <Send className="h-3 w-3" aria-hidden="true" />
          Publicar
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs gap-1"
          onClick={() => onOpen(carousel.id)}
        >
          <LayoutGrid className="h-3 w-3" aria-hidden="true" />
          {carousel.publishStatus === 'published' ? 'Ver' : 'Abrir'}
        </Button>
      )}

      {carousel.publishStatus === 'published' && carousel.igPermalink && (
        <a
          href={carousel.igPermalink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center h-7 w-7 rounded-md border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Ver en Instagram"
          title="Ver en Instagram"
        >
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
        onClick={() => onDelete(carousel.id)}
        disabled={isDeleting}
        aria-label="Eliminar carrusel"
        title="Eliminar"
      >
        <Trash2 className="h-3 w-3" aria-hidden="true" />
      </Button>
    </>
  )
}

// Grid card — used in expanded mode
function CarouselCard({ carousel, onOpen, onDelete, isDeleting }: CarouselCardProps): JSX.Element {
  return (
    <div className="group rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col">
      <button
        type="button"
        className="block w-full p-2 pb-0 cursor-pointer"
        onClick={() => onOpen(carousel.id)}
        aria-label={`Abrir carrusel: ${carousel.topic}`}
      >
        <CarouselThumbnail carousel={carousel} />
      </button>

      <div className="p-2.5 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-1.5">
          <p className="text-xs font-medium leading-tight line-clamp-2 flex-1">{carousel.topic}</p>
          <StatusBadge carousel={carousel} />
        </div>

        <p className="text-[10px] text-muted-foreground">
          {relativeTime(carousel.createdAt)}
          {carousel.slides.length > 0 && (
            <span className="ml-1.5">· {carousel.slides.length} slides</span>
          )}
        </p>

        <div className="flex items-center gap-1.5 pt-0.5">
          <CarouselActions carousel={carousel} onOpen={onOpen} onDelete={onDelete} isDeleting={isDeleting} />
        </div>
      </div>
    </div>
  )
}

// List row — used in compact (non-expanded) mode
function CarouselListItem({ carousel, onOpen, onDelete, isDeleting }: CarouselCardProps): JSX.Element {
  const hookSlide = carousel.slides.find((s) => s.role === 'hook') ?? carousel.slides[0]
  const imageUrl = hookSlide?.imageUrl

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 shadow-sm">
      {/* Small thumbnail */}
      <button
        type="button"
        className="shrink-0 cursor-pointer"
        onClick={() => onOpen(carousel.id)}
        aria-label={`Abrir carrusel: ${carousel.topic}`}
      >
        <div className="h-14 w-11 overflow-hidden rounded-md bg-muted/60 flex items-center justify-center">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resolveImageUrl(imageUrl)} alt={carousel.topic} className="h-full w-full object-cover" />
          ) : carousel.status === 'failed' ? (
            <AlertCircle className="h-4 w-4 text-destructive/50" aria-hidden="true" />
          ) : carousel.status === 'ready' ? (
            <ImageOff className="h-4 w-4 text-muted-foreground/40" aria-hidden="true" />
          ) : (
            <div className="h-4 w-4 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
          )}
        </div>
      </button>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1.5">
          <p className="truncate text-xs font-medium">{carousel.topic}</p>
          <div className="shrink-0"><StatusBadge carousel={carousel} /></div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {relativeTime(carousel.createdAt)}
          {carousel.slides.length > 0 && (
            <span className="ml-1">· {carousel.slides.length} slides</span>
          )}
        </p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        <CarouselActions carousel={carousel} onOpen={onOpen} onDelete={onDelete} isDeleting={isDeleting} />
      </div>
    </div>
  )
}

interface CarouselsSectionProps {
  activeCarouselId: string | null
  onOpenCarousel: (id: string) => void
  refreshTrigger?: number
  isExpanded?: boolean
  limits?: AgentLimits | undefined
}

export function CarouselsSection({
  activeCarouselId,
  onOpenCarousel,
  refreshTrigger,
  isExpanded = false,
  limits,
}: CarouselsSectionProps): JSX.Element {
  const [carousels, setCarousels] = useState<Carousel[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newTopic, setNewTopic] = useState('')
  const [scriptPreviewTopic, setScriptPreviewTopic] = useState<string | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const topicInputRef = useRef<HTMLInputElement>(null)

  const LIMIT = 12

  const fetchCarousels = useCallback(async (p: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await listCarousels(p, LIMIT)
      setCarousels(result.carousels)
      setTotal(result.total)
      setPage(p)
    } catch {
      setError('Error al cargar los carruseles')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchCarousels(1)
  }, [fetchCarousels, refreshTrigger])

  // Refresh the list when the active carousel changes status (e.g. becomes published)
  useEffect(() => {
    if (!activeCarouselId) return
    const timer = setTimeout(() => { void fetchCarousels(page) }, 3000)
    return () => clearTimeout(timer)
  }, [activeCarouselId, fetchCarousels, page])

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      return
    }
    setDeletingId(id)
    setConfirmDeleteId(null)
    try {
      await deleteCarousel(id)
      setCarousels((prev) => prev.filter((c) => c.id !== id))
      setTotal((t) => t - 1)
    } catch {
      setError('Error al eliminar el carrusel')
    } finally {
      setDeletingId(null)
    }
  }

  const handleOpenNewForm = () => {
    setShowNewForm(true)
    setNewTopic('')
    setTimeout(() => { topicInputRef.current?.focus() }, 50)
  }

  const handleCreate = () => {
    const topic = newTopic.trim()
    if (!topic) return
    setShowNewForm(false)
    setNewTopic('')
    setScriptPreviewTopic(topic)
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            {total > 0 ? `${total} carrusel${total !== 1 ? 'es' : ''}` : 'Sin carruseles aún'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => void fetchCarousels(page)}
            disabled={isLoading}
            aria-label="Actualizar lista"
            title="Actualizar"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setShowUploadModal(true)}
            title="Crear carrusel con mis fotos"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            Mis fotos
          </Button>
          <Button size="sm" className="h-8 gap-1.5" onClick={handleOpenNewForm}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            IA
          </Button>
        </div>
      </div>

      {/* Inline new carousel form */}
      {showNewForm && (
        <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            ¿Sobre qué tema querés crear el carrusel?
          </p>
          <input
            ref={topicInputRef}
            type="text"
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate() }}
            placeholder="Ej: 3 consejos para mejorar tu engagement en Instagram"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            maxLength={200}
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => setShowNewForm(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5"
              onClick={handleCreate}
              disabled={!newTopic.trim()}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Crear
            </Button>
          </div>
        </div>
      )}

      {/* Confirm delete banner */}
      {confirmDeleteId && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 flex items-center justify-between gap-3">
          <p className="text-sm text-destructive">¿Eliminar este carrusel? Esta acción no se puede deshacer.</p>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" className="h-7" onClick={() => setConfirmDeleteId(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-7 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => void handleDelete(confirmDeleteId)}
            >
              Eliminar
            </Button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
          <p className="text-sm text-destructive flex-1">{error}</p>
          <Button variant="outline" size="sm" className="h-7" onClick={() => void fetchCarousels(page)}>
            Reintentar
          </Button>
        </div>
      )}

      {/* Loading */}
      {isLoading && carousels.length === 0 ? (
        isExpanded ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-muted/30 animate-pulse">
                <div className="aspect-[4/5] rounded-t-xl bg-muted/50 m-2 mb-0 rounded-md" />
                <div className="p-2.5 space-y-2">
                  <div className="h-3 bg-muted/50 rounded w-3/4" />
                  <div className="h-2 bg-muted/30 rounded w-1/2" />
                  <div className="h-7 bg-muted/40 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border bg-muted/30 animate-pulse px-3 py-2.5">
                <div className="h-14 w-11 shrink-0 rounded-md bg-muted/50" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted/50 rounded w-3/4" />
                  <div className="h-2 bg-muted/30 rounded w-1/2" />
                </div>
                <div className="h-7 w-16 bg-muted/40 rounded" />
              </div>
            ))}
          </div>
        )
      ) : carousels.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center space-y-3">
          <LayoutGrid className="h-8 w-8 text-muted-foreground/40 mx-auto" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium">Sin carruseles todavía</p>
            <p className="text-xs text-muted-foreground mt-1">
              Creá uno desde el agente o usando el botón de arriba.
            </p>
          </div>
          <Button size="sm" onClick={handleOpenNewForm} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Crear primer carrusel
          </Button>
        </div>
      ) : isExpanded ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {carousels.map((carousel) => (
            <CarouselCard
              key={carousel.id}
              carousel={carousel}
              onOpen={onOpenCarousel}
              onDelete={(id) => void handleDelete(id)}
              isDeleting={deletingId === carousel.id}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {carousels.map((carousel) => (
            <CarouselListItem
              key={carousel.id}
              carousel={carousel}
              onOpen={onOpenCarousel}
              onDelete={(id) => void handleDelete(id)}
              isDeleting={deletingId === carousel.id}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => void fetchCarousels(page - 1)}
          >
            Anterior
          </Button>
          <span className="text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isLoading}
            onClick={() => void fetchCarousels(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}

      {/* Script preview modal — AI carousel flow */}
      {scriptPreviewTopic !== null && (
        <ScriptPreviewModal
          topic={scriptPreviewTopic}
          limits={limits}
          onClose={() => setScriptPreviewTopic(null)}
          onCreated={async (id) => {
            setScriptPreviewTopic(null)
            await fetchCarousels(1)
            onOpenCarousel(id)
          }}
        />
      )}

      {/* Upload carousel modal — user photo flow */}
      {showUploadModal && (
        <UploadCarouselModal
          onClose={() => setShowUploadModal(false)}
          onCreated={async (id) => {
            setShowUploadModal(false)
            await fetchCarousels(1)
            onOpenCarousel(id)
          }}
        />
      )}
    </div>
  )
}
