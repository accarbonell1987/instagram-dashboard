'use client'

import { useState } from 'react'

import { Button } from '@core/ui'
import { Eye, Bookmark, Share2, MessageCircle, Play, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

import type { ReelMedia } from '../types/instagram.types'

const PAGE_SIZE = 10

type SortKey = 'views' | 'savesShares' | 'date'

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

function MetricPill({ icon, value }: { icon: React.ReactNode; value: number }) {
  return (
    <div className="flex items-center gap-0.5 text-white/90">
      {icon}
      <span className="font-mono text-xs tabular-nums">{formatNumber(value)}</span>
    </div>
  )
}

function ReelThumbnail({ reel, onClick }: { reel: ReelMedia; onClick: () => void }) {
  const metrics = reel.metrics
  const views = metrics?.videoViews ?? metrics?.totalInteractions ?? 0

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
      aria-label={`Ver detalle del Reel del ${formatDate(reel.postedAt)}`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
        {reel.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={reel.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Play className="h-10 w-10 text-slate-400" />
          </div>
        )}

        {/* Play badge */}
        <div className="absolute left-2 top-2 rounded-full bg-black/40 p-1 backdrop-blur-sm">
          <Play className="h-3 w-3 fill-white text-white" />
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

        {/* Metrics on hover */}
        <div className="absolute bottom-0 left-0 right-0 translate-y-1 p-2 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            {metrics && (
              <>
                <MetricPill icon={<Eye className="h-3 w-3" />} value={views} />
                <MetricPill icon={<Bookmark className="h-3 w-3" />} value={metrics.saves} />
                <MetricPill icon={<Share2 className="h-3 w-3" />} value={metrics.shares} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Card footer */}
      <div className="mt-2 space-y-1.5 px-0.5">
        {/* Date + views inline */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span className="text-[11px]">{formatDate(reel.postedAt)}</span>
          </div>
          {metrics && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Eye className="h-3 w-3" />
              <span className="font-mono text-[11px] tabular-nums">{formatNumber(views)}</span>
            </div>
          )}
        </div>

        {/* Saves + Comments */}
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

        {/* Caption — 2 lines max */}
        {reel.caption && (
          <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
            {reel.caption}
          </p>
        )}
      </div>
    </button>
  )
}

interface ReelsListProps {
  reels: ReelMedia[]
  onSelectReel: (reelId: string) => void
}

export function ReelsList({ reels, onSelectReel }: ReelsListProps) {
  const [sortKey, setSortKey] = useState<SortKey>('views')
  const [page, setPage] = useState(1)

  const sorted = [...reels].sort((a, b) => {
    const am = a.metrics
    const bm = b.metrics
    if (sortKey === 'views') {
      return (bm?.videoViews ?? bm?.totalInteractions ?? 0) - (am?.videoViews ?? am?.totalInteractions ?? 0)
    }
    if (sortKey === 'savesShares') {
      return (
        ((bm?.saves ?? 0) + (bm?.shares ?? 0)) -
        ((am?.saves ?? 0) + (am?.shares ?? 0))
      )
    }
    return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
  })

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const pageReels = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const firstIndex = (page - 1) * PAGE_SIZE + 1
  const lastIndex = Math.min(page * PAGE_SIZE, sorted.length)

  const handleSortChange = (key: SortKey) => {
    setSortKey(key)
    setPage(1)
  }

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'views', label: 'Vistas' },
    { key: 'savesShares', label: 'Saves + Shares' },
    { key: 'date', label: 'Fecha' },
  ]

  if (reels.length === 0) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center">
        <Play className="text-muted-foreground h-10 w-10" />
        <p className="text-muted-foreground font-medium">No hay Reels sincronizados</p>
        <p className="text-muted-foreground text-sm">Sincronizá tu cuenta para ver tus Reels aquí.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs font-medium">Ordenar:</span>
          <div className="flex gap-1" role="group" aria-label="Ordenar Reels">
            {sortOptions.map(({ key, label }) => (
              <Button
                key={key}
                variant={sortKey === key ? 'default' : 'secondary'}
                size="sm"
                onClick={() => handleSortChange(key)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Counter */}
        <span className="text-muted-foreground text-xs tabular-nums">
          {firstIndex}–{lastIndex} de {sorted.length} reels
        </span>
      </div>

      {/* Grid */}
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        role="list"
        aria-label="Lista de Reels"
      >
        {pageReels.map((reel) => (
          <div key={reel.id} role="listitem">
            <ReelThumbnail reel={reel} onClick={() => onSelectReel(reel.id)} />
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
