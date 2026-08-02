'use client'

import { ArrowUp, ArrowDown, Minus, Telescope, Share2, Bookmark, UserPlus } from 'lucide-react'
import type { JSX } from 'react'

import type { NorthStarMetrics } from '../types/instagram.types'

function formatValue(value: number, isRate = false): string {
  if (isRate) return `${value.toFixed(2)}%`
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString()
}

function formatDelta(deltaPercent: number | null, delta: number, isRate = false): string {
  if (deltaPercent !== null) {
    const sign = deltaPercent >= 0 ? '+' : ''
    return `${sign}${deltaPercent.toFixed(1)}%`
  }
  const sign = delta >= 0 ? '+' : ''
  return isRate ? `${sign}${delta.toFixed(2)}pp` : `${sign}${delta.toLocaleString()}`
}

function DeltaDisplay({
  delta,
  deltaPercent,
  isRate,
}: {
  delta: number
  deltaPercent: number | null
  isRate?: boolean
}) {
  const isUp = delta > 0
  const isDown = delta < 0

  return (
    <div className="flex items-center gap-1">
      {isUp ? (
        <ArrowUp className="h-3 w-3 text-emerald-500" aria-hidden />
      ) : isDown ? (
        <ArrowDown className="h-3 w-3 text-red-500" aria-hidden />
      ) : (
        <Minus className="h-3 w-3 text-muted-foreground" aria-hidden />
      )}
      <span
        className={`text-xs font-medium tabular-nums ${
          isUp ? 'text-emerald-600 dark:text-emerald-400' : isDown ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
        }`}
      >
        {formatDelta(deltaPercent, delta, isRate)}
      </span>
      <span className="text-muted-foreground text-xs">vs período anterior</span>
    </div>
  )
}

interface ScorecardProps {
  label: string
  sublabel: string
  value: number
  delta: number
  deltaPercent: number | null
  icon: JSX.Element
  isRate?: boolean
  isLeader: boolean
}

function Scorecard({ label, sublabel, value, delta, deltaPercent, icon, isRate, isLeader }: ScorecardProps) {
  return (
    <div
      className={`bg-card border-border rounded-xl border p-5 transition-shadow ${
        isLeader ? 'ring-1 ring-emerald-500/20 dark:ring-emerald-400/10' : ''
      }`}
    >
      {/* Top row: icon left, badge right */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-muted-foreground/50">{icon}</span>
        {isLeader && (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/30 dark:text-emerald-400">
            líder
          </span>
        )}
      </div>

      <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-widest">
        {label}
      </p>
      <p
        className="text-foreground mb-1 font-mono text-3xl font-bold tracking-tight tabular-nums"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {formatValue(value, isRate)}
      </p>
      <p className="text-muted-foreground mb-3 text-xs">{sublabel}</p>
      <DeltaDisplay delta={delta} deltaPercent={deltaPercent} {...(isRate !== undefined ? { isRate } : {})} />
    </div>
  )
}

export function NorthStarScorecards({
  metrics,
}: {
  metrics: NorthStarMetrics
}) {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      role="list"
      aria-label="Métricas clave del período"
    >
      <div role="listitem">
        <Scorecard
          label="Alcance total"
          sublabel="Personas alcanzadas en el período"
          value={metrics.reachTotal.value}
          delta={metrics.reachTotal.delta}
          deltaPercent={metrics.reachTotal.deltaPercent}
          icon={<Telescope className="h-4 w-4" />}
          isLeader
        />
      </div>
      <div role="listitem">
        <Scorecard
          label="Tasa de shares"
          sublabel="Shares por cada 100 personas alcanzadas"
          value={metrics.shareRate.value}
          delta={metrics.shareRate.delta}
          deltaPercent={metrics.shareRate.deltaPercent}
          icon={<Share2 className="h-4 w-4" />}
          isRate
          isLeader
        />
      </div>
      <div role="listitem">
        <Scorecard
          label="Tasa de saves"
          sublabel="Saves por cada 100 personas alcanzadas"
          value={metrics.saveRate.value}
          delta={metrics.saveRate.delta}
          deltaPercent={metrics.saveRate.deltaPercent}
          icon={<Bookmark className="h-4 w-4" />}
          isRate
          isLeader
        />
      </div>
      <div role="listitem">
        <Scorecard
          label="Crecimiento neto"
          sublabel="Nuevos seguidores en el período"
          value={metrics.followerGrowth.value}
          delta={metrics.followerGrowth.delta}
          deltaPercent={metrics.followerGrowth.deltaPercent}
          icon={<UserPlus className="h-4 w-4" />}
          isLeader={false}
        />
      </div>
    </div>
  )
}
