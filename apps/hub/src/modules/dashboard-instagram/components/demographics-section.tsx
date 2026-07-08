'use client'

import { Button } from '@core/ui'
import { Info } from 'lucide-react'

import type { DemographicsData } from '../types/instagram.types'
import { AgeBreakdownChart } from './age-breakdown-chart'
import { RegionBreakdown } from './region-breakdown'
import { GenderDonut } from './gender-donut'
import { DemographicsSkeleton } from './loading-skeleton'

interface DemographicsSectionProps {
  data: DemographicsData | null
  isLoading: boolean
  error: string | null
  onRetry?: () => void
}

export function DemographicsSection({ data, isLoading, error, onRetry }: DemographicsSectionProps) {
  if (isLoading) return <DemographicsSkeleton />

  if (error) {
    return (
      <div className="bg-destructive/10 border-destructive/20 rounded-xl border p-6 text-center">
        <p className="text-destructive mb-2 text-sm font-medium">Error al cargar demografía</p>
        <p className="text-muted-foreground mb-3 text-xs">{error}</p>
        {onRetry && (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onRetry}
          >
            Reintentar
          </Button>
        )}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-10 text-center">
        <p className="text-muted-foreground text-sm">No hay datos demográficos disponibles.</p>
        <p className="text-muted-foreground max-w-xs text-xs">
          La demografía requiere 100+ seguidores. Sincronizá tu cuenta para actualizar.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Coverage notice */}
      <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-4 py-3 dark:bg-blue-950/30">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" aria-hidden />
        <p className="text-xs text-blue-700 dark:text-blue-400">
          Basado en el <strong>{data.coveragePercent}%</strong> de tus seguidores con datos disponibles
          ({data.totalFollowersWithData.toLocaleString()} de {data.followersTotal.toLocaleString()}).
          La suma puede ser menor al total porque Instagram solo reporta seguidores con datos demográficos completos.
        </p>
      </div>

      {/* Age + Gender row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-card border-border rounded-xl border p-5">
          <h4 className="text-muted-foreground mb-4 text-xs font-semibold uppercase tracking-widest">
            Rango de edad
          </h4>
          <AgeBreakdownChart data={data.age} />
        </div>
        <div className="bg-card border-border rounded-xl border p-5">
          <h4 className="text-muted-foreground mb-4 text-xs font-semibold uppercase tracking-widest">
            Género
          </h4>
          <GenderDonut data={data.gender} />
        </div>
      </div>

      {/* Region */}
      <div className="bg-card border-border rounded-xl border p-5">
        <h4 className="text-muted-foreground mb-4 text-xs font-semibold uppercase tracking-widest">
          Región
        </h4>
        <RegionBreakdown countries={data.countries} cities={data.cities} />
      </div>
    </div>
  )
}
