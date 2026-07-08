import type { ContentFinding, FormatBreakdown, HeatmapCell } from '../domain/insight.js';

// Posts mínimos en un bucket para que el hallazgo sea computado
const TENTATIVE_MIN = 2;
// Posts mínimos para confianza "consistent"
const CONSISTENT_MIN = 5;
// Ratio mínimo para que el hallazgo valga la pena mostrar (30% mejor)
const MIN_LIFT = 1.3;

type RankingItem = {
  mediaType: string;
  saves: number;
  shares: number;
  caption: string | null;
};

const DAY_LABELS: Record<number, string> = {
  0: 'domingos', 1: 'lunes', 2: 'martes', 3: 'miércoles',
  4: 'jueves', 5: 'viernes', 6: 'sábados',
};

const SLOT_LABELS: Record<number, string> = {
  0: 'madrugada (0-6h)', 1: 'mañana (6-12h)', 2: 'tarde (12-18h)', 3: 'noche (18-24h)',
};

/**
 * Pure function — computes up to 4 prescriptive findings from already-aggregated
 * dashboard data. No DB calls. Shared by the REST endpoint and the growth agent.
 */
export function computeFindings(
  formatBreakdown: FormatBreakdown[],
  heatmap: HeatmapCell[],
  ranking: RankingItem[],
): ContentFinding[] {
  const candidates: ContentFinding[] = [];

  const formatFinding = findFormatPattern(formatBreakdown);
  if (formatFinding) candidates.push(formatFinding);

  const timeFinding = findPostingTimePattern(heatmap);
  if (timeFinding) candidates.push(timeFinding);

  const topFinding = findTopCommonality(ranking);
  if (topFinding) candidates.push(topFinding);

  const captionFinding = findCaptionLengthPattern(ranking);
  if (captionFinding) candidates.push(captionFinding);

  // Consistent findings first; break ties by postCount descending
  return candidates
    .sort((a, b) => {
      if (a.confidence !== b.confidence) return a.confidence === 'consistent' ? -1 : 1;
      return b.postCount - a.postCount;
    })
    .slice(0, 4);
}

// ─── Format pattern ───────────────────────────────────────────────────────────

function findFormatPattern(breakdown: FormatBreakdown[]): ContentFinding | null {
  const eligible = breakdown.filter((f) => f.postCount >= TENTATIVE_MIN);
  if (eligible.length < 2) return null;

  // Normalize by reach when available; otherwise use raw avg
  const scored = eligible.map((f) => ({
    ...f,
    score: f.avgReach > 0
      ? (f.avgSaves + f.avgShares) / f.avgReach
      : f.avgSaves + f.avgShares,
  }));

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]!;
  const second = scored[1]!;

  if (second.score === 0 || best.score / second.score < MIN_LIFT) return null;

  const multiplier = (best.score / second.score).toFixed(1);
  const keyNumber = `${multiplier}×`;
  const label = toFormatLabel(best.format);

  return {
    type: 'format',
    pattern: `Tus ${label} generan ${keyNumber} más guardados+compartidos que otros formatos`,
    keyNumber,
    action: `Probá priorizar ${label} en tus próximas publicaciones y medí si el patrón se mantiene`,
    confidence: best.postCount >= CONSISTENT_MIN ? 'consistent' : 'tentative',
    postCount: best.postCount,
  };
}

// ─── Posting time pattern ─────────────────────────────────────────────────────

function findPostingTimePattern(heatmap: HeatmapCell[]): ContentFinding | null {
  const withPosts = heatmap.filter((c) => c.postCount >= TENTATIVE_MIN);
  if (withPosts.length < 2) return null;

  const cells = withPosts.map((c) => ({
    ...c,
    avgScore: c.totalSavesShares / c.postCount,
  }));

  cells.sort((a, b) => b.avgScore - a.avgScore);
  const best = cells[0]!;
  const overallAvg = cells.reduce((s, c) => s + c.avgScore, 0) / cells.length;

  if (overallAvg === 0 || best.avgScore / overallAvg < MIN_LIFT) return null;

  const lift = (best.avgScore / overallAvg).toFixed(1);
  const keyNumber = `${lift}×`;
  const dayLabel = DAY_LABELS[best.dayIndex] ?? best.day.toLowerCase();
  const slotLabel = SLOT_LABELS[best.slotIndex] ?? best.slot.toLowerCase();

  return {
    type: 'posting_time',
    pattern: `Publicar los ${dayLabel} de ${slotLabel} te da ${keyNumber} más guardados+compartidos que tu promedio`,
    keyNumber,
    action: `Programá tu próxima publicación para un ${dayLabel} de ${slotLabel}`,
    confidence: best.postCount >= CONSISTENT_MIN ? 'consistent' : 'tentative',
    postCount: best.postCount,
  };
}

// ─── Top posts commonality ────────────────────────────────────────────────────

function findTopCommonality(ranking: RankingItem[]): ContentFinding | null {
  if (ranking.length < 3) return null;
  const top = ranking.slice(0, Math.min(3, ranking.length));

  const formatCounts = new Map<string, number>();
  for (const p of top) {
    const fmt = normalizeMediaType(p.mediaType);
    formatCounts.set(fmt, (formatCounts.get(fmt) ?? 0) + 1);
  }

  const dominant = Array.from(formatCounts.entries()).sort((a, b) => b[1] - a[1])[0];
  if (!dominant || dominant[1] < 2) return null;

  const pct = Math.round((dominant[1] / top.length) * 100);
  const keyNumber = `${pct}%`;
  const label = toFormatLabel(dominant[0]);

  return {
    type: 'top_commonality',
    pattern: `${keyNumber} de tus mejores posts son ${label} — tu formato con mejor rendimiento hasta ahora`,
    keyNumber,
    action: `Usá ${label} como formato base esta semana y medí si el patrón se confirma`,
    confidence: 'tentative',
    postCount: top.length,
  };
}

// ─── Caption length pattern ───────────────────────────────────────────────────

type CaptionBucket = 'corta' | 'media' | 'larga';

const CAPTION_LABELS: Record<CaptionBucket, string> = {
  corta: 'captions cortas (−80 car.)',
  media: 'captions medianas (80-300 car.)',
  larga: 'captions largas (+300 car.)',
};

const CAPTION_ACTIONS: Record<CaptionBucket, string> = {
  corta: 'Escribí captions breves (menos de 80 caracteres) y medí si el engagement mejora',
  media: 'Apuntá a captions de 80-300 caracteres y medí si el engagement mejora',
  larga: 'Extendé tus captions a más de 300 caracteres y medí si el engagement mejora',
};

function bucketCaption(caption: string): CaptionBucket {
  if (caption.length < 80) return 'corta';
  if (caption.length < 300) return 'media';
  return 'larga';
}

function findCaptionLengthPattern(ranking: RankingItem[]): ContentFinding | null {
  const withCaption = ranking.filter((p) => typeof p.caption === 'string' && p.caption.trim().length > 0);
  if (withCaption.length < 4) return null;

  const grouped = new Map<CaptionBucket, { total: number; count: number }>();
  for (const p of withCaption) {
    const bucket = bucketCaption(p.caption!);
    const entry = grouped.get(bucket) ?? { total: 0, count: 0 };
    entry.total += p.saves + p.shares;
    entry.count += 1;
    grouped.set(bucket, entry);
  }

  const eligible = Array.from(grouped.entries())
    .filter(([, v]) => v.count >= TENTATIVE_MIN)
    .map(([bucket, v]) => ({ bucket, avg: v.total / v.count, count: v.count }))
    .sort((a, b) => b.avg - a.avg);

  if (eligible.length < 2) return null;

  const best = eligible[0]!;
  const second = eligible[1]!;
  if (second.avg === 0 || best.avg / second.avg < MIN_LIFT) return null;

  const lift = (best.avg / second.avg).toFixed(1);

  return {
    type: 'caption_length',
    pattern: `Posts con ${CAPTION_LABELS[best.bucket]} generan ${lift}× más guardados+compartidos`,
    keyNumber: `${lift}×`,
    action: CAPTION_ACTIONS[best.bucket],
    confidence: best.count >= CONSISTENT_MIN ? 'consistent' : 'tentative',
    postCount: best.count,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeMediaType(mediaType: string): string {
  if (mediaType === 'CAROUSEL_ALBUM') return 'Carousel';
  if (mediaType === 'VIDEO') return 'Reel';
  return 'Image';
}

function toFormatLabel(format: string): string {
  if (format === 'Carousel') return 'carruseles';
  if (format === 'Reel') return 'Reels';
  if (format === 'Image') return 'imágenes';
  return format.toLowerCase();
}
