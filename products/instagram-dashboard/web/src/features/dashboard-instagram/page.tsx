'use client';

import { useModuleAccess } from '@core/entitlements/react';
import { Button } from '@core/ui';
import type { JSX } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';


import { ConnectAccount } from './components/connect-account';
import { ContentIntelligenceSection } from './components/content-intelligence-section';
import { DemographicsSection } from './components/demographics-section';
import { FloatingAgent } from './components/floating-agent';
import type { ActiveTab } from './components/floating-agent';
import { GrowthChart } from './components/growth-chart';
import { ScorecardsSkeleton, PublicationsListSkeleton } from './components/loading-skeleton';
import { MediaDetailPanel } from './components/media-detail-panel';
import { NorthStarScorecards } from './components/north-star-scorecards';
import { ProfileHeader } from './components/profile-header';
import { PublicationsList } from './components/publications-list';
import { SectionHeader } from './components/section-header';
import { SyncStatusBadge } from './components/sync-status-badge';
import { useGrowthAgent } from './hooks/use-growth-agent';
import {
  useInstagramDashboard,
  useConnectionStatus,
  useSyncStatus,
  useGrowthData,
  usePublications,
  useDemographics,
} from './hooks/use-instagram-dashboard';
import { backfillFollowerHistory, getMyModules } from './services/instagram.service';
import type {
  ContentFinding,
  FormatBreakdown,
  GrowthMetric,
  GrowthPeriod,
  HeatmapCell,
  InstagramProfile,
  NorthStarMetrics,
  PublicationFilter,
  TopPost,
} from './types/instagram.types';

export function DashboardInstagramPage(): JSX.Element {
  const { isConnected, isLoading: isCheckingConnection } = useConnectionStatus();
  const { moduleIds, error: modulesError, refetch: refetchModules } = useModuleAccess({
    fetcher: getMyModules,
    fallbackErrorMessage: 'Error al cargar permisos',
  });

  // Fail closed while permissions are unknown (loading or errored) — `?? false`
  // means no section fetches until we actually know what's granted.
  const hasBasicMetrics = moduleIds?.has('ig-basic-metrics') ?? false;
  const hasPublications = moduleIds?.has('ig-publications') ?? false;
  const hasAudience = moduleIds?.has('ig-audience') ?? false;
  const hasContentIntelligence = moduleIds?.has('ig-content-intelligence') ?? false;
  const hasAgent = moduleIds?.has('ig-ai-agent') ?? false;

  const permittedTabs = useMemo<ActiveTab[]>(() => {
    if (!moduleIds) return [];
    return (
      [
        ['chat', 'ig-ai-chat'],
        ['suggestions', 'ig-ai-suggestions'],
        ['carousels', 'ig-ai-carousels'],
      ] as const
    )
      .filter(([, moduleId]) => moduleIds.has(moduleId))
      .map(([tab]) => tab);
  }, [moduleIds]);
  // An agent with no permitted tabs is not a feature — hide the whole widget.
  const isAgentVisible = hasAgent && permittedTabs.length > 0;

  const { data, isLoading, error, refetch } = useInstagramDashboard('30d', {
    enabled: isConnected,
  });
  const { syncState, triggerSync, isTriggering } = useSyncStatus({ enabled: isConnected });
  // ponytail: gates the whole agent fetch set (chat history, suggestion batches,
  // config) on the widget being visible at all. It doesn't further split fetches
  // per-tab (e.g. skip chat history when only carousels is permitted) — add that
  // if per-tab fetch cost becomes a real concern.
  const growthAgent = useGrowthAgent({ enabled: isAgentVisible });
  const [growthMetric, setGrowthMetric] = useState<GrowthMetric>('reach');
  const [growthPeriod, setGrowthPeriod] = useState<GrowthPeriod>('1y');
  const growthData = useGrowthData(growthMetric, growthPeriod, {
    enabled: isConnected && hasBasicMetrics,
  });
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);

  const handleBackfill = async () => {
    setIsBackfilling(true);
    setBackfillMessage(null);
    try {
      const result = await backfillFollowerHistory();
      setBackfillMessage(
        result.inserted > 0
          ? `${String(result.inserted)} registros históricos cargados`
          : 'El historial ya está completo',
      );
      if (result.inserted > 0) {
        await growthData.refetch();
      }
    } catch {
      setBackfillMessage('Error al cargar el historial');
    } finally {
      setIsBackfilling(false);
    }
  };

  // Publications section
  const [publicationsFilter, setPublicationsFilter] = useState<PublicationFilter>('all');
  const publicationsData = usePublications(publicationsFilter, {
    enabled: isConnected && hasPublications,
  });
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const publicationsScrollRef = useRef<number>(0);

  // Demographics section (lazy-loaded when visible)
  const demographicsData = useDemographics({ enabled: isConnected && !!data && hasAudience });

  // Refetch all data after sync completes
  const prevSyncStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prevSyncStatus.current === 'syncing' && syncState?.status === 'idle') {
      void refetch();
      void publicationsData.refetch();
      void growthData.refetch();
      void demographicsData.refetch();
    }
    prevSyncStatus.current = syncState?.status;
  }, [syncState?.status, refetch, publicationsData.refetch, growthData.refetch, demographicsData.refetch]);

  // Preserve scroll when opening media detail. The detail panel is part of
  // ig-publications — refuse to open it without the module, even if the click
  // originated from a different section (e.g. content intelligence's ranking).
  const handleSelectMedia = (id: string) => {
    if (!hasPublications) return;
    publicationsScrollRef.current = window.scrollY;
    setSelectedMediaId(id);
  };

  const handleCloseMedia = () => {
    setSelectedMediaId(null);
    window.scrollTo({ top: publicationsScrollRef.current, behavior: 'instant' });
  };

  // ── Guards ────────────────────────────────────────────────────────────────

  if (isCheckingConnection) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground text-sm">Verificando conexión con Instagram...</p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <ConnectAccount />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        <ScorecardsSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="bg-destructive/10 border-destructive/30 rounded-xl border p-6 text-center">
          <p className="text-destructive mb-1 font-medium">Error al cargar el dashboard</p>
          <p className="text-muted-foreground mb-4 text-sm">{error}</p>
          <Button
            variant="default"
            onClick={() => void refetch()}
          >
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="py-12 text-center">
          <h2 className="mb-2 text-xl font-semibold">Cuenta conectada</h2>
          <p className="text-muted-foreground mb-4 text-sm">
            Sincronizando tu cuenta de Instagram...
          </p>
          <SyncStatusBadge
            syncState={syncState}
            onTriggerSync={triggerSync}
            isTriggering={isTriggering}
          />
        </div>
      </div>
    );
  }

  if (modulesError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="bg-destructive/10 border-destructive/30 rounded-xl border p-6 text-center">
          <p className="text-destructive mb-1 font-medium">No pudimos verificar tus permisos</p>
          <p className="text-muted-foreground mb-4 text-sm">{modulesError}</p>
          <Button
            variant="default"
            onClick={() => void refetchModules()}
          >
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  if (moduleIds === null) {
    // Permissions haven't resolved yet — reuse the dashboard's own loading
    // skeleton instead of a blank page while we wait to know what to show.
    return (
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        <ScorecardsSkeleton />
      </div>
    );
  }

  // ── Data mapping ──────────────────────────────────────────────────────────

  interface BackendData {
    account?: {
      username: string;
      displayName: string | null;
      profilePictureUrl: string | null;
      accountType: string;
      followerCount: number | null;
      mediaCount: number | null;
    };
    overview?: {
      totalPosts: number;
      totalSaves: number;
      totalShares: number;
      totalImpressions: number;
      totalReach: number;
    };
    ranking?: TopPost[];
    formatBreakdown?: FormatBreakdown[];
    heatmap?: HeatmapCell[];
    findings?: ContentFinding[];
    northStar?: NorthStarMetrics;
    lastUpdated?: string;
  }
  const backend = data as unknown as BackendData;

  const profile: InstagramProfile = {
    username: backend.account?.username ?? '',
    fullName: backend.account?.displayName ?? backend.account?.username ?? '',
    avatarUrl: backend.account?.profilePictureUrl ?? '',
    bio: '',
    website: undefined,
    isVerified: false,
    isBusiness: backend.account?.accountType === 'BUSINESS',
    followersCount: backend.account?.followerCount ?? 0,
    followingCount: 0,
    postsCount: backend.account?.mediaCount ?? backend.overview?.totalPosts ?? 0,
  };

  const northStar = backend.northStar;
  const ranking = backend.ranking ?? [];
  const formatBreakdown = backend.formatBreakdown ?? [];
  const heatmap = backend.heatmap ?? [];
  const findings = backend.findings ?? [];

  // Baseline views for Reel comparison (median from reels only)
  const reelViews = (publicationsData.data?.data ?? [])
    .filter((m) => m.mediaProductType === 'REELS')
    .map((r) => r.metrics?.videoViews ?? r.metrics?.totalInteractions ?? 0)
    .sort((a, b) => a - b);
  const medianViews =
    reelViews.length > 0 ? reelViews[Math.floor(reelViews.length / 2)] : undefined;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-12 px-4 py-6 sm:px-6 lg:px-8">

        {/* ── HEADER ───────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <ProfileHeader
              profile={profile}
              rightContent={
                <SyncStatusBadge
                  syncState={syncState}
                  onTriggerSync={triggerSync}
                  isTriggering={isTriggering}
                />
              }
            />
          </div>
        </div>

        {/* ── A. NORTH-STAR SCORECARDS ──────────────────────────────────────── */}
        {hasBasicMetrics && (
        <section aria-labelledby="section-north-star">
          <div className="mb-5 space-y-1">
            <SectionHeader
              title="Métricas clave"
              description="Indicadores que predicen el crecimiento. Los más accionables."
              badge="leader"
            />
          </div>

          {northStar ? (
            <NorthStarScorecards metrics={northStar} />
          ) : (
            <ScorecardsSkeleton />
          )}

          {/* Lagging indicators note */}
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-inset ring-slate-500/20 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-600/30">
              resultado
            </span>
            <span className="text-muted-foreground text-xs">
              Seguidores totales y visitas al perfil son indicadores rezagados — reflejan el pasado, no predicen el futuro.
            </span>
          </div>

          {/* New account note */}
          <div className="mt-2 flex items-start gap-2 rounded-md bg-blue-50 px-3 py-2 dark:bg-blue-950/20">
            <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs text-blue-700 dark:text-blue-300">
              ¿Métricas en cero? Es normal para cuentas recién conectadas. Instagram tarda entre 24 y 48 horas en acumular los datos diarios de alcance, interacciones y crecimiento. Volvé mañana.
            </span>
          </div>
        </section>
        )}

        {/* ── GROWTH CHART ──────────────────────────────────────────────────── */}
        {hasBasicMetrics && (
        <section aria-labelledby="section-growth">
          <div className="mb-4 flex items-start justify-between gap-3">
            <SectionHeader title="Evolución" description="Historial completo desde tu primera sincronización" />
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void handleBackfill()}
                disabled={isBackfilling}
              >
                {isBackfilling ? (
                  <>
                    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Cargando...
                  </>
                ) : (
                  <>
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 0 0-9-9M3 12a9 9 0 0 0 9 9" />
                      <path d="m21 3-3 3 3 3" />
                      <path d="m3 21 3-3-3-3" />
                    </svg>
                    Cargar historial
                  </>
                )}
              </Button>
              {backfillMessage && (
                <span className="text-muted-foreground text-[11px]">{backfillMessage}</span>
              )}
            </div>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs font-medium">Métrica:</span>
            {(
              [
                ['reach', 'Alcance'],
                ['followers', 'Seguidores'],
                ['engagement', 'Engagement'],
                ['impressions', 'Impresiones'],
                ['profileViews', 'Perfil'],
              ] as [GrowthMetric, string][]
            ).map(([m, label]) => (
              <Button
                key={m}
                variant={growthMetric === m ? 'default' : 'secondary'}
                size="sm"
                onClick={() => { setGrowthMetric(m); }}
              >
                {label}
              </Button>
            ))}
          </div>
          <GrowthChart
            data={growthData.data}
            metric={growthMetric}
            period={growthPeriod}
            onPeriodChange={setGrowthPeriod}
            isLoading={growthData.isLoading}
          />
          {growthData.data.length > 0 && growthData.data.every((d) => d.value === 0) && (
            <p className="mt-2 text-xs text-muted-foreground text-center">
              Los datos diarios de Instagram tardan 24-48 horas en aparecer para cuentas recién conectadas.
            </p>
          )}
        </section>
        )}

        {/* ── B. INTELIGENCIA DE CONTENIDO ──────────────────────────────────── */}
        {hasContentIntelligence && (
        <section aria-labelledby="section-content-intel">
          <div className="mb-5">
            <SectionHeader
              title="Inteligencia de contenido"
              description="Qué hace que tu contenido funcione — y qué hacer diferente esta semana."
            />
          </div>
          <ContentIntelligenceSection
            findings={findings}
            ranking={ranking}
            formatBreakdown={formatBreakdown}
            heatmap={heatmap}
            onPostClick={handleSelectMedia}
          />
        </section>
        )}

        {/* ── C. PUBLICACIONES ─────────────────────────────────────────────── */}
        {hasPublications && (
        <section aria-labelledby="section-publications">
          <div className="mb-5">
            <SectionHeader
              title="Publicaciones"
              description="Todas tus publicaciones con métricas. Filtrá por tipo y hacé clic para ver el detalle."
              badge="leader"
            />
          </div>

          {publicationsData.isLoading ? (
            <PublicationsListSkeleton />
          ) : publicationsData.error ? (
            <div className="bg-destructive/10 border-destructive/20 rounded-xl border p-4 text-center">
              <p className="text-destructive text-sm">{publicationsData.error}</p>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => void publicationsData.refetch()}
              >
                Reintentar
              </Button>
            </div>
          ) : (
            <PublicationsList
              publications={publicationsData.data?.data ?? []}
              filter={publicationsFilter}
              onFilterChange={setPublicationsFilter}
              onSelectMedia={handleSelectMedia}
            />
          )}
        </section>
        )}

        {/* ── D. AUDIENCIA ─────────────────────────────────────────────────── */}
        {hasAudience && (
        <section aria-labelledby="section-audience">
          <div className="mb-5">
            <SectionHeader
              title="Audiencia"
              description="Quién te sigue — edad, género y ubicación."
            />
          </div>

          <DemographicsSection
            data={demographicsData.data}
            isLoading={demographicsData.isLoading}
            error={demographicsData.error}
            onRetry={() => void demographicsData.refetch()}
          />
        </section>
        )}

        {/* Last updated */}
        {backend.lastUpdated && (
          <p className="text-muted-foreground text-right text-xs">
            Última actualización: {new Date(backend.lastUpdated).toLocaleString('es-AR')}
          </p>
        )}
      </div>

      {/* Media detail panel — outside main flow, overlay. Guarded via
          handleSelectMedia (never sets selectedMediaId without ig-publications),
          so this stays closed on its own when the module isn't granted. */}
      <MediaDetailPanel
        mediaId={selectedMediaId}
        onClose={handleCloseMedia}
        {...(medianViews !== undefined ? { baselineViews: medianViews } : {})}
      />

      {/* Floating growth agent — hidden entirely without ig-ai-agent, or when
          none of its tabs are permitted (see isAgentVisible above). */}
      {isAgentVisible && <FloatingAgent hook={growthAgent} permittedTabs={permittedTabs} />}
    </>
  );
}
