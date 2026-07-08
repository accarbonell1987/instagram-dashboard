'use client'

import { Progress } from '@core/ui'
import {
  X,
  ExternalLink,
  Eye,
  Bookmark,
  Share2,
  MessageCircle,
  Heart,
  Clock,
  TrendingUp,
  LayoutGrid,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { useEffect, useRef, useState, useCallback } from 'react'

import type { ReelMedia } from '../types/instagram.types'
import { useReelDetail } from '../hooks/use-instagram-dashboard'
import { getReelPlaybackUrl } from '../services/instagram.service'

function formatMs(ms: number): string {
  const seconds = ms / 1000
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60)
    const s = Math.round(seconds % 60)
    return `${m}m ${s}s`
  }
  return `${seconds.toFixed(1)}s`
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function MediaDetailSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="bg-muted aspect-square w-full rounded-xl mx-auto" />
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-muted h-16 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-muted/40 rounded-lg p-3">
      <div className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-foreground font-mono text-lg font-bold tabular-nums">
        {value}
      </p>
    </div>
  )
}

function getMediaLabel(media: ReelMedia): string {
  if (media.mediaProductType === 'REELS') return 'Reel'
  if (media.mediaType === 'CAROUSEL_ALBUM') return 'Carrusel'
  return 'Imagen'
}

function MediaPreview({ media }: { media: ReelMedia }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoLoading, setVideoLoading] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const isVideo = media.mediaType === 'VIDEO' || media.mediaProductType === 'REELS'

  const fetchVideoUrl = useCallback(async () => {
    setVideoUrl(null)
    setVideoError(false)
    setVideoLoading(true)
    try {
      const url = await getReelPlaybackUrl(media.id)
      setVideoUrl(url)
    } catch {
      setVideoError(true)
    } finally {
      setVideoLoading(false)
    }
  }, [media.id])

  useEffect(() => {
    if (!isVideo) return
    void fetchVideoUrl()
    return () => {
      if (videoRef.current) videoRef.current.pause()
    }
  }, [isVideo, fetchVideoUrl])

  if (!isVideo) {
    return (
      <div className="rounded-xl overflow-hidden bg-black relative">
        {media.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.thumbnailUrl}
            alt={media.caption ?? 'Publicación de Instagram'}
            className="w-full max-h-[420px] object-contain"
          />
        ) : (
          <div className="flex h-48 items-center justify-center gap-2 text-white/40">
            {media.mediaType === 'CAROUSEL_ALBUM' ? (
              <LayoutGrid className="h-10 w-10" />
            ) : null}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden bg-black relative">
      {videoLoading && (
        <div className="flex h-48 items-center justify-center gap-2 text-white/60">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Cargando video...</span>
        </div>
      )}

      {!videoLoading && videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          playsInline
          className="w-full max-h-[420px] object-contain"
          poster={media.thumbnailUrl ?? undefined}
        />
      )}

      {!videoLoading && !videoUrl && !videoError && media.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.thumbnailUrl}
          alt="Miniatura del video"
          className="w-full max-h-[420px] object-contain"
        />
      )}

      {!videoLoading && videoError && (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-white/50">
          <AlertCircle className="h-6 w-6" />
          <span className="text-xs">No se pudo cargar el video</span>
        </div>
      )}
    </div>
  )
}

interface MediaDetailPanelProps {
  mediaId: string | null
  onClose: () => void
  baselineViews?: number
}

export function MediaDetailPanel({ mediaId, onClose, baselineViews }: MediaDetailPanelProps) {
  const { data: media, isLoading } = useReelDetail(mediaId)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    if (mediaId) panelRef.current?.focus()
  }, [mediaId])

  const isOpen = mediaId !== null
  const isReel = media?.mediaProductType === 'REELS'
  const label = media ? getMediaLabel(media) : 'Publicación'

  const primaryMetric = isReel
    ? (media?.metrics?.videoViews ?? media?.metrics?.totalInteractions ?? 0)
    : (media?.metrics?.reach ?? 0)

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de ${label}`}
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto bg-background shadow-2xl transition-transform duration-300 focus-visible:outline-none ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="border-b border-border sticky top-0 bg-background/95 backdrop-blur-md z-10 flex items-center justify-between px-5 py-4">
          <h3 className="font-semibold">Detalle de {label}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Cerrar panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {isLoading && <MediaDetailSkeleton />}

          {!isLoading && media && (
            <>
              <MediaPreview media={media} />

              {/* Meta */}
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs">
                  {new Date(media.postedAt).toLocaleDateString('es-AR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                {media.caption && (
                  <p className="text-sm leading-relaxed">{media.caption}</p>
                )}
                {media.permalink && (
                  <a
                    href={media.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                  >
                    Ver en Instagram
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {/* Metrics grid */}
              {media.metrics ? (
                <>
                  <div>
                    <h4 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-widest">
                      Métricas
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <MetricCard
                        label={isReel ? 'Vistas' : 'Alcance'}
                        value={formatNumber(primaryMetric)}
                        icon={isReel ? <Eye className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                      />
                      <MetricCard
                        label={isReel ? 'Alcance' : 'Impresiones'}
                        value={formatNumber(isReel ? media.metrics.reach : media.metrics.impressions)}
                        icon={<TrendingUp className="h-3.5 w-3.5" />}
                      />
                      <MetricCard
                        label="Likes"
                        value={formatNumber(media.metrics.likes)}
                        icon={<Heart className="h-3.5 w-3.5" />}
                      />
                      <MetricCard
                        label="Comentarios"
                        value={formatNumber(media.metrics.comments)}
                        icon={<MessageCircle className="h-3.5 w-3.5" />}
                      />
                      <MetricCard
                        label="Saves"
                        value={formatNumber(media.metrics.saves)}
                        icon={<Bookmark className="h-3.5 w-3.5" />}
                      />
                      <MetricCard
                        label="Shares"
                        value={formatNumber(media.metrics.shares)}
                        icon={<Share2 className="h-3.5 w-3.5" />}
                      />
                    </div>
                  </div>

                  {/* Retention — only for reels */}
                  {isReel && (
                    <div>
                      <h4 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-widest">
                        Retención
                      </h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-sm">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>Watch time promedio</span>
                          </div>
                          <span className="font-mono text-sm font-medium tabular-nums">
                            {media.metrics.avgWatchTime !== null
                              ? formatMs(media.metrics.avgWatchTime)
                              : <span className="text-muted-foreground text-xs">no disponible</span>}
                          </span>
                        </div>

                        {media.metrics.avgWatchTime !== null && media.metrics.videoViewTotalTime !== null && (
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Tiempo total acumulado</span>
                            <span className="font-mono tabular-nums">
                              {formatMs(media.metrics.videoViewTotalTime)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Baseline comparison — only for reels */}
                  {isReel && baselineViews !== undefined && baselineViews > 0 && (
                    <div>
                      <h4 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-widest">
                        Comparación vs tu baseline
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Este Reel</span>
                          <span className="font-mono tabular-nums">
                            {formatNumber(media.metrics.videoViews ?? media.metrics.totalInteractions)} vistas
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>Tu mediana</span>
                          <span className="font-mono tabular-nums">{formatNumber(baselineViews)} vistas</span>
                        </div>
                        {(() => {
                          const thisViews = media.metrics.videoViews ?? media.metrics.totalInteractions
                          const ratio = Math.min(Math.round((thisViews / baselineViews) * 100), 200)
                          const isAbove = thisViews >= baselineViews
                          return (
                            <div className="space-y-1">
                              <Progress value={Math.min(ratio, 100)} className="h-2" />
                              <p className={`text-xs font-medium ${isAbove ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                {isAbove
                                  ? `${ratio}% de la mediana — superó el baseline`
                                  : `${ratio}% de la mediana — por debajo del baseline`}
                              </p>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  No hay métricas sincronizadas para esta publicación.
                </p>
              )}
            </>
          )}

          {!isLoading && !media && mediaId !== null && (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No se pudo cargar el detalle.
            </p>
          )}
        </div>
      </div>
    </>
  )
}
