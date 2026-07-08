import type { DashboardData, InsightResult } from '../domain/insight.js';

export class InsightService {
  generateInsight(dashboardData: DashboardData): InsightResult {
    const { ranking, formatBreakdown, heatmap } = dashboardData;

    // Rule 1: Best format by avg saves+shares
    if (formatBreakdown.length > 1) {
      const bestFormat = formatBreakdown.reduce((best, curr) =>
        (curr.avgSaves + curr.avgShares) / curr.postCount >
        (best.avgSaves + best.avgShares) / best.postCount
          ? curr
          : best,
      );

      const totalAvg =
        formatBreakdown.reduce((sum, f) => sum + f.avgSaves + f.avgShares, 0) /
        formatBreakdown.length;
      const bestAvg = bestFormat.avgSaves + bestFormat.avgShares;

      if (bestAvg > totalAvg * 1.2 && bestFormat.postCount >= 3) {
        const percentExtra = Math.round(((bestAvg - totalAvg) / totalAvg) * 100);
        return {
          insight: `💡 Tus publicaciones en formato ${bestFormat.format} generan ${String(percentExtra)}% más saves+shares que tu promedio. Considerá crear más contenido en este formato.`,
          generatedAt: new Date().toISOString(),
        };
      }
    }

    // Rule 2: Best day + time slot
    if (heatmap.length > 0) {
      const bestSlot = heatmap.reduce((best, curr) =>
        curr.totalSavesShares > best.totalSavesShares ? curr : best,
      );

      if (bestSlot.totalSavesShares > 0 && bestSlot.postCount >= 2) {
        return {
          insight: `💡 Tus publicaciones de los ${bestSlot.day} en la franja ${bestSlot.slot} tienen el mayor engagement (${String(bestSlot.totalSavesShares)} saves+shares en ${String(bestSlot.postCount)} posts). Probá publicar más en ese horario.`,
          generatedAt: new Date().toISOString(),
        };
      }
    }

    // Rule 3: Check ranking for concentration pattern
    if (ranking.length >= 10) {
      const top3Saves = ranking.slice(0, 3).reduce((sum, r) => sum + r.saves, 0);
      const bottom3Saves = ranking.slice(-3).reduce((sum, r) => sum + r.saves, 0);

      if (top3Saves > bottom3Saves * 5) {
        return {
          insight:
            '💡 Tus 3 mejores publicaciones concentran muchísimo más engagement que el resto. Analizá qué tienen en común (formato, horario, estilo) para replicar ese éxito.',
          generatedAt: new Date().toISOString(),
        };
      }
    }

    // Default: no strong insight
    return {
      insight:
        'Sincronizá más publicaciones para recibir insights personalizados sobre tu contenido.',
      generatedAt: new Date().toISOString(),
    };
  }
}
