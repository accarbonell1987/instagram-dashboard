'use client'

import { Button } from '@core/ui'
import {
  Eye,
  Bookmark,
  Share2,
  MessageCircle,
  Play,
  LayoutGrid,
  TrendingUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useState } from 'react'

import type { PublicationFilter, ReelMedia } from '../types/instagram.types'

const PAGE_SIZE = 12

type SortKey = 'engagement' | 'reach' | 'views' | 'date'

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

function getMediaCategory(media: ReelMedia): 'reel' | 'image' | 'carousel' {
  if (media.mediaProductType === 'REELS') return 'reel'
  if (media.mediaType === 'CAROUSEL_ALBUM') return 'carousel'
  return 'image'
}

function MetricPill({ icon, value }: { icon: React.ReactNode; value: number }) {
  return (
    <div className="flex items-center gap-0.5 text-white/90">
      {icon}
      <span className="font-mono text-xs tabular-nums">{formatNumber(value)}</span>
    </div>
  )
}

function MediaCard({ media, onClick }: { media: ReelMedia; onClick: () => void }) {
  const category = getMediaCategory(media)
  const metrics = media.metrics
  const isReel = category === 'reel'
  const isCarousel = category === 'carousel'

  const primaryMetric = isReel
    ? (metrics?.videoViews ?? metrics?.totalInteractions ?? 0)
    : (metrics?.reach ?? 0)
  const primaryIcon = isReel ? <Eye className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />

  const ariaLabel = `Ver detalle de ${isReel ? 'Reel' : isCarousel ? 'Carrusel' : 'imagen'} del ${formatDate(media.postedAt)}`

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
      aria-label={ariaLabel}
    >
      {/* Thumbnail */}
      <div
        className={`relative w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 ${
          isReel ? 'aspect-[9/16]' : 'aspect-square'
        }`}
      >
        {media.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-400">
            {isReel ? (
              <Play className="h-10 w-10" />
            ) : isCarousel ? (
              <LayoutGrid className="h-10 w-10" />
            ) : null}
          </div>
        )}

        {/* Type badge */}
        {(isReel || isCarousel) && (
          <div className="absolute left-2 top-2 rounded-full bg-black/40 p-1 backdrop-blur-sm">
            {isReel ? (
              <Play className="h-3 w-3 fill-white text-white" />
            ) : (
              <LayoutGrid className="h-3 w-3 text-white" />
            )}
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

        {/* Metrics on hover */}
        <div className="absolute bottom-0 left-0 right-0 translate-y-1 p-2 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            {metrics && (
              <>
                <MetricPill icon={primaryIcon} value={primaryMetric} />
                <MetricPill icon={<Bookmark className="h-3 w-3" />} value={metrics.saves} />
                <MetricPill icon={<Share2 className="h-3 w-3" />} value={metrics.shares} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Card footer */}
      <div className="mt-2 space-y-1.5 px-0.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span className="text-[11px]">{formatDate(media.postedAt)}</span>
          </div>
          {metrics && (
            <div className="flex items-center gap-1 text-muted-foreground">
              {primaryIcon}
              <span className="font-mono text-[11px] tabular-nums">{formatNumber(primaryMetric)}</span>
            </div>
          )}
        </div>

        {metrics && (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Bookmark className="h-3 w-3" />
              <span className="font-mono text-[11px] tabular-nums">{formatNumber(metrics.saves)}</span>
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <MessageCircle className="h-3 w-3" />
              <span className="font-mono text-[11px] tabular-nums">{formatNumber(metrics.comments)}</span>
            </span>
          </div>
        )}

        {media.caption && (
          <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
            {media.caption}
          </p>
        )}
      </div>
    </button>
  )
}

const FILTER_LABELS: Record<PublicationFilter, string> = {
  all: 'Todas',
  image: 'Imágenes',
  carousel: 'Carruseles',
  reel: 'Reels',
}

interface PublicationsListProps {
  publications: ReelMedia[]
  filter: PublicationFilter
  onFilterChange: (filter: PublicationFilter) => void
  onSelectMedia: (mediaId: string) => void
}

export function PublicationsList({
  publications,
  filter,
  onFilterChange,
  onSelectMedia,
}: PublicationsListProps) {
  const [sortKey, setSortKey] = useState<SortKey>('engagement')
  const [page, setPage] = useState(1)

  const hasReels = filter === 'reel' || filter === 'all'

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'engagement', label: 'Saves+Shares' },
    { key: 'reach', label: 'Alcance' },
    ...(hasReels ? [{ key: 'views' as SortKey, label: 'Vistas' }] : []),
    { key: 'date', label: 'Fecha' },
  ]

  const sorted = [...publications].sort((a, b) => {
    const am = a.metrics
    const bm = b.metrics
    if (sortKey === 'engagement') {
      return (
        ((bm?.saves ?? 0) + (bm?.shares ?? 0)) -
        ((am?.saves ?? 0) + (am?.shares ?? 0))
      )
    }
    if (sortKey === 'reach') {
      return (bm?.reach ?? 0) - (am?.reach ?? 0)
    }
    if (sortKey === 'views') {
      return (
        (bm?.videoViews ?? bm?.totalInteractions ?? 0) -
        (am?.videoViews ?? am?.totalInteractions ?? 0)
      )
    }
    return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
  })

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const firstIndex = (page - 1) * PAGE_SIZE + 1
  const lastIndex = Math.min(page * PAGE_SIZE, sorted.length)

  const handleFilterChange = (newFilter: PublicationFilter) => {
    onFilterChange(newFilter)
    setPage(1)
    if (newFilter !== 'reel' && newFilter !== 'all' && sortKey === 'views') {
      setSortKey('engagement')
    }
  }

  const handleSortChange = (key: SortKey) => {
    setSortKey(key)
    setPage(1)
  }

  const filters: PublicationFilter[] = ['all', 'image', 'carousel', 'reel']

  if (publications.length === 0) {
    return (
      <div className="space-y-4">
        {/* Category filter chips */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo">
          {filters.map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'secondary'}
              size="sm"
              onClick={() => { handleFilterChange(f) }}
            >
              {FILTER_LABELS[f]}
            </Button>
          ))}
        </div>

        <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center">
          <LayoutGrid className="text-muted-foreground h-10 w-10" />
          <p className="text-muted-foreground font-medium">No hay publicaciones</p>
          <p className="text-muted-foreground text-sm">
            {filter === 'all'
              ? 'Sincronizá tu cuenta para ver tus publicaciones aquí.'
              : `No hay ${FILTER_LABELS[filter].toLowerCase()} sincronizadas.`}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Category filter chips */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo">
          {filters.map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'secondary'}
              size="sm"
              onClick={() => { handleFilterChange(f) }}
            >
              {FILTER_LABELS[f]}
            </Button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs font-medium">Ordenar:</span>
          <div className="flex gap-1" role="group" aria-label="Ordenar publicaciones">
            {sortOptions.map(({ key, label }) => (
              <Button
                key={key}
                variant={sortKey === key ? 'default' : 'secondary'}
                size="sm"
                onClick={() => { handleSortChange(key) }}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Counter */}
      <div className="flex justify-end">
        <span className="text-muted-foreground text-xs tabular-nums">
          {firstIndex}–{lastIndex} de {sorted.length} publicaciones
        </span>
      </div>

      {/* Grid — reels use portrait cards, images/carousels use square */}
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        role="list"
        aria-label="Lista de publicaciones"
      >
        {pageItems.map((media) => (
          <div key={media.id} role="listitem">
            <MediaCard media={media} onClick={() => onSelectMedia(media.id)} />
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Anterior
          </Button>

          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Button
                key={p}
                variant={p === page ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setPage(p)}
                aria-label={`Ir a página ${p}`}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </Button>
            ))}
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            aria-label="Página siguiente"
          >
            Siguiente
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
