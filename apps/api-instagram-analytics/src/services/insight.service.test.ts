import { describe, it, expect } from 'vitest';
import { InsightService } from './insight.service.js';
import type { DashboardData } from '../domain/insight.js';

function createMockDashboard(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    period: '7d',
    account: {
      username: 'test',
      displayName: null,
      profilePictureUrl: null,
      accountType: 'BUSINESS',
      followerCount: 1000,
      mediaCount: null,
    },
    overview: {
      totalPosts: 20,
      totalSaves: 200,
      totalShares: 100,
      totalImpressions: 5000,
      totalReach: 3000,
    },
    ranking: [
      {
        id: 'uuid-1',
        igMediaId: '1',
        mediaType: 'VIDEO',
        permalink: null,
        caption: null,
        thumbnailUrl: null,
        postedAt: '2026-01-01',
        saves: 50,
        shares: 25,
        likes: 0,
        comments: 0,
        reach: 0,
        totalEngagement: 75,
      },
      {
        id: 'uuid-2',
        igMediaId: '2',
        mediaType: 'IMAGE',
        permalink: null,
        caption: null,
        thumbnailUrl: null,
        postedAt: '2026-01-02',
        saves: 5,
        shares: 2,
        likes: 0,
        comments: 0,
        reach: 0,
        totalEngagement: 7,
      },
    ],
    formatBreakdown: [
      {
        format: 'Reel',
        postCount: 8,
        avgSaves: 45,
        avgShares: 22,
        avgLikes: 100,
        avgComments: 10, avgReach: 0,
      },
      {
        format: 'Image',
        postCount: 12,
        avgSaves: 15,
        avgShares: 5,
        avgLikes: 60,
        avgComments: 4, avgReach: 0,
      },
    ],
    heatmap: [
      {
        day: 'Lun',
        dayIndex: 1,
        slot: '12-18',
        slotIndex: 2,
        totalSavesShares: 200,
        postCount: 4,
      },
      {
        day: 'Dom',
        dayIndex: 0,
        slot: '00-06',
        slotIndex: 0,
        totalSavesShares: 10,
        postCount: 1,
      },
    ],
    insight: { insight: '', generatedAt: '' },
    ...overrides,
  };
}

describe('InsightService', () => {
  const service = new InsightService();

  describe('generateInsight', () => {
    it('generates format insight when one format significantly outperforms', () => {
      const data = createMockDashboard();
      const result = service.generateInsight(data);

      // Format "Reel" has avgSaves+avgShares=67 per post, Image=20 per post
      // Total average across formats = (67+20)/2 = 43.5
      // 67 > 43.5 * 1.2 = 52.2 → trigger Rule 1 (format insight)
      expect(result.insight).toContain('Reel');
      expect(result.insight).not.toBe('');
      expect(result.generatedAt).toBeTruthy();
    });

    it('generates heatmap insight when a clear best slot exists', () => {
      const data = createMockDashboard({
        formatBreakdown: [
          {
            format: 'Reel',
            postCount: 10,
            avgSaves: 20,
            avgShares: 10,
            avgLikes: 50,
            avgComments: 5, avgReach: 0,
          },
          {
            format: 'Image',
            postCount: 10,
            avgSaves: 18,
            avgShares: 9,
            avgLikes: 48,
            avgComments: 5, avgReach: 0,
          },
        ],
      });

      const result = service.generateInsight(data);

      // Format breakdown: both similar → Rule 1 NOT triggered
      // Heatmap: Lun 12-18 has totalSavesShares=200, postCount=4 >= 2 → Rule 2 triggered
      expect(result.insight).toContain('Lun');
      expect(result.generatedAt).toBeTruthy();
    });

    it('returns default insight when no strong patterns exist', () => {
      const data = createMockDashboard({
        formatBreakdown: [],
        heatmap: [],
        ranking: [],
      });

      const result = service.generateInsight(data);
      expect(result.insight).toContain('Sincronizá más publicaciones');
      expect(result.generatedAt).toBeTruthy();
    });

    it('generates concentration insight when top posts dominate', () => {
      // Make format breakdown not trigger Rule 1 (both formats similar)
      // and heatmap not trigger Rule 2 (less than 2 posts)
      // so Rule 3 (concentration) fires on the ranking
      const ranking = Array.from({ length: 25 }, (_, i) => ({
        id: `uuid-${i}`,
        igMediaId: `${i}`,
        mediaType: 'IMAGE' as const,
        permalink: null,
        caption: null,
        thumbnailUrl: null,
        postedAt: '2026-01-01',
        saves: i < 3 ? 100 : 2,
        shares: 0,
        likes: 0,
        comments: 0,
        reach: 0,
        totalEngagement: i < 3 ? 100 : 2,
      }));
      const data = createMockDashboard({
        ranking,
        // Balanced format breakdown — no format significantly outperforms
        formatBreakdown: [
          {
            format: 'Reel',
            postCount: 10,
            avgSaves: 20,
            avgShares: 10,
            avgLikes: 50,
            avgComments: 5, avgReach: 0,
          },
          {
            format: 'Image',
            postCount: 10,
            avgSaves: 18,
            avgShares: 9,
            avgLikes: 48,
            avgComments: 5, avgReach: 0,
          },
        ],
        // Heatmap with only 1 post — Rule 2 won't trigger
        heatmap: [
          {
            day: 'Lun',
            dayIndex: 1,
            slot: '12-18',
            slotIndex: 2,
            totalSavesShares: 200,
            postCount: 1,
          },
        ],
      });

      const result = service.generateInsight(data);

      // Top 3 saves = 300, bottom 3 saves = 6. 300 > 6*5 = 30 → Rule 3 triggered
      expect(result.insight).toContain('3 mejores');
      expect(result.generatedAt).toBeTruthy();
    });

    it('returns default when format breakdown has insufficient post count for best format', () => {
      const data = createMockDashboard({
        formatBreakdown: [
          {
            format: 'Reel',
            postCount: 1,
            avgSaves: 100,
            avgShares: 50,
            avgLikes: 200,
            avgComments: 20, avgReach: 0,
          },
          {
            format: 'Image',
            postCount: 15,
            avgSaves: 5,
            avgShares: 2,
            avgLikes: 20,
            avgComments: 3, avgReach: 0,
          },
        ],
      });

      const result = service.generateInsight(data);

      // Reel has 150 avg saves+shares per post, Image=7.
      // But postCount for Reel is 1 (< 3 minimum) → Rule 1 NOT triggered
      // Heatmap will be checked next (Lun 12-18 has 200 saves+shares, 4 posts → Rule 2 triggered)
      expect(result.generatedAt).toBeTruthy();
    });

    it('returns default when heatmap best slot has less than 2 posts', () => {
      const data = createMockDashboard({
        formatBreakdown: [],
        heatmap: [
          {
            day: 'Lun',
            dayIndex: 1,
            slot: '12-18',
            slotIndex: 2,
            totalSavesShares: 500,
            postCount: 1,
          },
        ],
        ranking: [],
      });

      const result = service.generateInsight(data);

      // Best heatmap slot has 500 saves+shares but only 1 post (need >=2) → Rule 2 NOT triggered
      // Fall back to default
      expect(result.insight).toContain('Sincronizá más publicaciones');
    });

    it('falls through rules in order: format first, then heatmap, then concentration', () => {
      // Everything passes thresholds → format insight (Rule 1) takes priority
      const data = createMockDashboard();

      const result = service.generateInsight(data);

      // Rule 1 (format) executes first because formatBreakdown.length > 1
      // Reel: avgSaves 45 + avgShares 22 = 67 per post
      // Image: avgSaves 15 + avgShares 5 = 20 per post
      // 67 > 43.5 * 1.2 = 52.2 → Rule 1 fires, Rule 2 and 3 are skipped
      expect(result.insight).toContain('Reel');
      expect(result.insight).not.toContain('Lun'); // Rule 2 skipped
      expect(result.insight).not.toContain('3 mejores'); // Rule 3 skipped
    });
  });
});
