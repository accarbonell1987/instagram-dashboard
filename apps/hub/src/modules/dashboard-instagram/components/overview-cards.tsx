import { ArrowDown, ArrowUp, Minus, Users, Heart, Eye, BarChart3, UserPlus } from 'lucide-react'
import type { JSX } from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

import type { OverviewStats } from '../types/instagram.types'

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function formatPercentage(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <ArrowUp className="h-3.5 w-3.5 text-green-500" />
  if (trend === 'down') return <ArrowDown className="h-3.5 w-3.5 text-red-500" />
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />
}

function TrendColor({ trend }: { trend: string }) {
  if (trend === 'up') return 'text-green-600'
  if (trend === 'down') return 'text-red-600'
  return 'text-muted-foreground'
}

interface MetricCardProps {
  label: string
  value: number
  previous: number
  trend: string
  percentageChange: number
  icon: JSX.Element
  sparkline?: number[]
}

function sparklineColor(points: number[]): string {
  if (points.length < 2) return '#6b7280' // gray
  const first = points[0]!
  const last = points[points.length - 1]!
  if (last > first) return '#22c55e' // green up
  if (last < first) return '#ef4444' // red down
  return '#6b7280' // gray flat
}

function MetricCard({ label, value, trend, percentageChange, icon, sparkline }: MetricCardProps) {
  return (
    <div className="bg-card border-border rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
          {label}
        </span>
        <span className="text-muted-foreground/60">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight">{formatNumber(value)}</p>
      <div className="mt-1 flex items-center gap-1">
        <TrendIcon trend={trend} />
        <span className={`text-xs font-medium ${TrendColor({ trend })}`}>
          {formatPercentage(percentageChange)}
        </span>
        <span className="text-muted-foreground text-xs">vs. período anterior</span>
      </div>
      {sparkline && sparkline.length >= 2 && (
        <div className="mt-2">
          <ResponsiveContainer width={80} height={30}>
            <LineChart data={sparkline.map((v, i) => ({ i, v }))}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={sparklineColor(sparkline)}
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export function OverviewCards({
  stats,
  trends,
}: {
  stats: OverviewStats
  trends?: Record<string, number[]>
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <MetricCard
        label="Seguidores"
        value={stats.followers.current}
        previous={stats.followers.previous}
        trend={stats.followers.trend}
        percentageChange={stats.followers.percentageChange}
        icon={<Users className="h-4 w-4" />}
        {...(trends?.['followers'] !== undefined && { sparkline: trends['followers'] })}
      />
      <MetricCard
        label="Engagement"
        value={stats.engagement.current}
        previous={stats.engagement.previous}
        trend={stats.engagement.trend}
        percentageChange={stats.engagement.percentageChange}
        icon={<Heart className="h-4 w-4" />}
        {...(trends?.['engagement'] !== undefined && { sparkline: trends['engagement'] })}
      />
      <MetricCard
        label="Alcance"
        value={stats.reach.current}
        previous={stats.reach.previous}
        trend={stats.reach.trend}
        percentageChange={stats.reach.percentageChange}
        icon={<Eye className="h-4 w-4" />}
        {...(trends?.['reach'] !== undefined && { sparkline: trends['reach'] })}
      />
      <MetricCard
        label="Impresiones"
        value={stats.impressions.current}
        previous={stats.impressions.previous}
        trend={stats.impressions.trend}
        percentageChange={stats.impressions.percentageChange}
        icon={<BarChart3 className="h-4 w-4" />}
        {...(trends?.['impressions'] !== undefined && { sparkline: trends['impressions'] })}
      />
      <MetricCard
        label="Visitas al perfil"
        value={stats.profileViews.current}
        previous={stats.profileViews.previous}
        trend={stats.profileViews.trend}
        percentageChange={stats.profileViews.percentageChange}
        icon={<UserPlus className="h-4 w-4" />}
        {...(trends?.['profileViews'] !== undefined && { sparkline: trends['profileViews'] })}
      />
    </div>
  )
}
