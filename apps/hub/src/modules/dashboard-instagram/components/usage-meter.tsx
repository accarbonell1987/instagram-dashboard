'use client'

import type { JSX } from 'react'
import type { UsageResponse } from '../types/instagram.types'

interface UsageMeterProps {
  usage: UsageResponse | null
  isLoading: boolean
}

type ResourceLabel = 'deepseek_tokens' | 'fal_images'

function formatNumber(n: number): string {
  if (n >= 1000) {
    const k = n / 1000
    // Only show decimal if it's a round number
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(1).replace(/\.0$/, '')}K`
  }
  return String(n)
}

function getColorClass(used: number, limit: number): string {
  if (limit <= 0) return 'bg-emerald-500'
  const pct = used / limit
  if (pct >= 0.95) return 'bg-red-500'
  if (pct >= 0.80) return 'bg-orange-500'
  if (pct >= 0.50) return 'bg-yellow-500'
  return 'bg-emerald-500'
}

function getTextColorClass(used: number, limit: number): string {
  if (limit <= 0) return 'text-emerald-400'
  const pct = used / limit
  if (pct >= 0.95) return 'text-red-400'
  if (pct >= 0.80) return 'text-orange-400'
  if (pct >= 0.50) return 'text-yellow-300'
  return 'text-emerald-400'
}

const RESOURCE_LABELS: Record<ResourceLabel, string> = {
  deepseek_tokens: 'Tokens',
  fal_images: 'Imágenes',
}

export function UsageMeter({ usage, isLoading }: UsageMeterProps): JSX.Element | null {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 animate-pulse" aria-label="Cargando uso..." role="status">
        <div className="h-3 w-16 rounded bg-zinc-700" />
        <div className="h-3 w-12 rounded bg-zinc-700" />
        <div className="h-3 w-16 rounded bg-zinc-700" />
      </div>
    )
  }

  if (usage === null) return null

  const resources: ResourceLabel[] = ['deepseek_tokens', 'fal_images']

  return (
    <div className="flex items-center gap-2" aria-label="Medidor de uso de recursos">
      {resources.map((resourceType) => {
        const quota = usage.quotas[resourceType]
        const isUnlimited = quota.limit <= 0 || quota.period === 'unlimited'
        const barColor = getColorClass(quota.used, quota.limit)
        const textColor = getTextColorClass(quota.used, quota.limit)
        const label = RESOURCE_LABELS[resourceType]
        const pct = !isUnlimited && quota.limit > 0 ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 100

        return (
          <div
            key={resourceType}
            className="flex items-center gap-1.5"
            title={
              isUnlimited
                ? `${label}: Ilimitado`
                : `${label}: ${formatNumber(quota.used)} / ${formatNumber(quota.limit)}`
            }
          >
            {isUnlimited ? (
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                Ilimitado
              </span>
            ) : (
              <>
                <span
                  className={`text-[10px] font-medium ${textColor} min-w-[65px] text-right`}
                  data-testid={`${resourceType}-label`}
                >
                  {label}: {formatNumber(quota.used)}/{formatNumber(quota.limit)}
                </span>
                <div
                  className="h-1.5 w-12 rounded-full bg-zinc-700 overflow-hidden"
                  data-testid={`${resourceType}-bar`}
                >
                  <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
