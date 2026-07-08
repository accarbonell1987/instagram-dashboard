'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  X,
  ExternalLink,
  Eye,
  Bookmark,
  Share2,
  MessageCircle,
  Heart,
  Play,
  Clock,
  TrendingUp,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Button, Progress } from '@core/ui'

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

function MetricCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-muted/40 rounded-lg p-3">
      <div className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <p
        className="text-foreground font-mono text-lg font-bold tabular-nums"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </p>
    </div>
  )
}

function ReelDetailSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="bg-muted aspect-[9/16] w-full max-w-[180px] rounded-xl mx-auto" />
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-muted h-16 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

interface ReelDetailPanelProps {
  reelId: string | null
  onClose: () => void
  baselineViews?: number
}

export function ReelDetailPanel({ reelId, onClose, baselineViews }: ReelDetailPanelProps) {
  const { data: reel, isLoading } = useReelDetail(reelId)
  const panelRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Video playback state
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoLoading, setVideoLoading] = useState(false)
  const [videoError, setVideoError] = useState(false)

  const fetchVideoUrl = useCallback(async (id: string) => {
    setVideoUrl(null)
    setVideoError(false)
    setVideoLoading(true)
    try {
      const url = await getReelPlaybackUrl(id)
      setVideoUrl(url)
    } catch {
      setVideoError(true)
    } finally {
      setVideoLoading(false)
    }
  }, [])

  // Fetch video URL when a reel is selected
  useEffect(() => {
    if (!reelId) {
      setVideoUrl(null)
      setVideoError(false)
      return
    }
    void fetchVideoUrl(reelId)
  }, [reelId, fetchVideoUrl])

  // Pause video when panel closes
  useEffect(() => {
    if (!reelId && videoRef.current) {
      videoRef.current.pause()
    }
  }, [reelId])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Focus panel when opened
  useEffect(() => {
    if (reelId) panelRef.current?.focus()
  }, [reelId])

  const isOpen = reelId !== null

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
        aria-label="Detalle del Reel"
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto bg-background shadow-2xl transition-transform duration-300 focus-visible:outline-none ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="border-b border-border sticky top-0 bg-background/95 backdrop-blur-md z-10 flex items-center justify-between px-5 py-4">
          <h3 className="font-semibold">Detalle del Reel</h3>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Cerrar panel"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-5 space-y-6">
          {isLoading && <ReelDetailSkeleton />}

          {!isLoading && reel && (
            <>
              {/* Video player */}
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
                    poster={reel.thumbnailUrl ?? undefined}
                  />
                )}

                {!videoLoading && !videoUrl && !videoError && reel.thumbnailUrl && (
                  // No media_url available — show thumbnail as fallback
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={reel.thumbnailUrl}
                    alt="Miniatura del Reel"
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

              {/* Meta: date + caption + link */}
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs">
                  {new Date(reel.postedAt).toLocaleDateString('es-AR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                {reel.caption && (
                  <p className="text-sm leading-relaxed">{reel.caption}</p>
                )}
                {reel.permalink && (
                  <a
                    href={reel.permalink}
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
              {reel.metrics ? (
                <>
                  <div>
                    <h4 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-widest">
                      Métricas
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <MetricCard
                        label="Vistas"
                        value={formatNumber(reel.metrics.videoViews ?? reel.metrics.totalInteractions)}
                        icon={<Eye className="h-3.5 w-3.5" />}
                      />
                      <MetricCard
                        label="Alcance"
                        value={formatNumber(reel.metrics.reach)}
                        icon={<TrendingUp className="h-3.5 w-3.5" />}
                      />
                      <MetricCard
                        label="Likes"
                        value={formatNumber(reel.metrics.likes)}
                        icon={<Heart className="h-3.5 w-3.5" />}
                      />
                      <MetricCard
                        label="Comentarios"
                        value={formatNumber(reel.metrics.comments)}
                        icon={<MessageCircle className="h-3.5 w-3.5" />}
                      />
                      <MetricCard
                        label="Saves"
                        value={formatNumber(reel.metrics.saves)}
                        icon={<Bookmark className="h-3.5 w-3.5" />}
                      />
                      <MetricCard
                        label="Shares"
                        value={formatNumber(reel.metrics.shares)}
                        icon={<Share2 className="h-3.5 w-3.5" />}
                      />
                    </div>
                  </div>

                  {/* Retention block */}
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
                          {reel.metrics.avgWatchTime !== null
                            ? formatMs(reel.metrics.avgWatchTime)
                            : <span className="text-muted-foreground text-xs">no disponible</span>}
                        </span>
                      </div>

                      {reel.metrics.avgWatchTime !== null && reel.metrics.videoViewTotalTime !== null && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Tiempo total acumulado</span>
                            <span className="font-mono tabular-nums">
                              {formatMs(reel.metrics.videoViewTotalTime)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Baseline comparison */}
                  {baselineViews !== undefined && baselineViews > 0 && (
                    <div>
                      <h4 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-widest">
                        Comparación vs tu baseline
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Este Reel</span>
                          <span className="font-mono tabular-nums">
                            {formatNumber(reel.metrics.videoViews ?? reel.metrics.totalInteractions)} vistas
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>Tu mediana</span>
                          <span className="font-mono tabular-nums">{formatNumber(baselineViews)} vistas</span>
                        </div>
                        {(() => {
                          const thisViews = reel.metrics.videoViews ?? reel.metrics.totalInteractions
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
                  No hay métricas sincronizadas para este Reel.
                </p>
              )}
            </>
          )}

          {!isLoading && !reel && reelId !== null && (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No se pudo cargar el detalle.
            </p>
          )}
        </div>
      </div>
    </>
  )
}
