'use client'

import { Skeleton } from '@core/ui'
import type { ContentFinding, FormatBreakdown, HeatmapCell, TopPost } from '../types/instagram.types'
import { FindingCard } from './finding-card'
import { FormatBreakdownChart } from './format-breakdown-chart'
import { PostingHeatmap } from './posting-heatmap'
import { TopPostsRanking } from './top-posts-ranking'

// ── Skeleton ──────────────────────────────────────────────────────────────────

function FindingsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-4 w-32 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="border-t pt-3">
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function NoFindingsState() {
  return (
    <div className="rounded-xl border border-dashed border-muted-foreground/25 p-8 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/50">
        <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </div>
      <p className="text-sm font-medium text-foreground">Todavía no hay suficientes datos</p>
      <p className="mt-1.5 text-sm text-muted-foreground max-w-sm mx-auto">
        Necesitamos más publicaciones para detectar patrones confiables. Seguí publicando y volvé en unas semanas.
      </p>
    </div>
  )
}

// ── Section label ─────────────────────────────────────────────────────────────

function SubLabel({ children }: { children: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70 mb-4">
      {children}
    </p>
  )
}

// ── ContentIntelligenceSection ────────────────────────────────────────────────

interface ContentIntelligenceSectionProps {
  findings: ContentFinding[]
  ranking: TopPost[]
  formatBreakdown: FormatBreakdown[]
  heatmap: HeatmapCell[]
  isLoading?: boolean
  onPostClick?: (igMediaId: string) => void
}

export function ContentIntelligenceSection({
  findings,
  ranking,
  formatBreakdown,
  heatmap,
  isLoading = false,
  onPostClick,
}: ContentIntelligenceSectionProps) {
  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <SubLabel>Hallazgos clave</SubLabel>
          <FindingsSkeleton />
        </div>
      </div>
    )
  }

  const hasChartData = formatBreakdown.length > 0 || heatmap.some((c) => c.postCount > 0) || ranking.length > 0

  return (
    <div className="space-y-8">
      {/* ── Prescriptive findings ── */}
      <div>
        <SubLabel>Hallazgos clave</SubLabel>
        {findings.length === 0 ? (
          <NoFindingsState />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {findings.map((finding, i) => (
              <FindingCard key={`${finding.type}-${i}`} finding={finding} />
            ))}
          </div>
        )}
      </div>

      {/* ── Evidence charts — only when there are findings or raw data ── */}
      {hasChartData && (
        <div>
          <SubLabel>
            {findings.length > 0 ? 'Evidencia de los hallazgos' : 'Datos disponibles'}
          </SubLabel>
          <div className="space-y-6">
            <FormatBreakdownChart breakdown={formatBreakdown} />
            <PostingHeatmap cells={heatmap} />
            <TopPostsRanking ranking={ranking} {...(onPostClick !== undefined && { onPostClick })} />
          </div>
        </div>
      )}
    </div>
  )
}
