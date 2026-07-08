import { http, HttpResponse } from 'msw';

const API_BASE = 'http://localhost:3003';

// Mock data
const mockConnectionStatus = {
  success: true,
  data: {
    connected: false,
  },
};

const mockDashboardData = {
  success: true,
  data: {
    period: '7d',
    account: {
      username: 'corehub.lat',
      accountType: 'BUSINESS',
      followerCount: 1250,
    },
    overview: {
      totalPosts: 24,
      totalSaves: 342,
      totalShares: 156,
      totalImpressions: 12500,
      totalReach: 8900,
    },
    ranking: [
      {
        igMediaId: '1',
        mediaType: 'VIDEO',
        permalink: '#',
        caption: 'Reel viral',
        postedAt: '2026-06-01T10:00:00Z',
        saves: 89,
        shares: 45,
        totalEngagement: 134,
      },
      {
        igMediaId: '2',
        mediaType: 'CAROUSEL_ALBUM',
        permalink: '#',
        caption: 'Carrusel tips',
        postedAt: '2026-06-02T14:00:00Z',
        saves: 67,
        shares: 32,
        totalEngagement: 99,
      },
      {
        igMediaId: '3',
        mediaType: 'IMAGE',
        permalink: '#',
        caption: 'Foto producto',
        postedAt: '2026-06-03T09:00:00Z',
        saves: 45,
        shares: 18,
        totalEngagement: 63,
      },
    ],
    formatBreakdown: [
      {
        format: 'Reel',
        postCount: 8,
        avgSaves: 52,
        avgShares: 28,
        avgLikes: 120,
        avgComments: 15,
      },
      {
        format: 'Carousel',
        postCount: 6,
        avgSaves: 38,
        avgShares: 20,
        avgLikes: 95,
        avgComments: 12,
      },
      {
        format: 'Image',
        postCount: 10,
        avgSaves: 25,
        avgShares: 12,
        avgLikes: 80,
        avgComments: 8,
      },
    ],
    heatmap: [
      {
        day: 'Lun',
        dayIndex: 1,
        slot: '12-18',
        slotIndex: 2,
        totalSavesShares: 245,
        postCount: 4,
      },
      {
        day: 'Mié',
        dayIndex: 3,
        slot: '06-12',
        slotIndex: 1,
        totalSavesShares: 198,
        postCount: 3,
      },
      {
        day: 'Jue',
        dayIndex: 4,
        slot: '18-24',
        slotIndex: 3,
        totalSavesShares: 167,
        postCount: 3,
      },
    ],
    insight: {
      insight:
        '💡 Tus Reels publicados entre las 12 y las 18 generan 180% más saves+shares que tu promedio. Considerá crear más contenido en este formato y horario.',
      generatedAt: new Date().toISOString(),
    },
    lastUpdated: new Date().toISOString(),
  },
};

export const instagramHandlers = [
  // Auth
  http.get(`${API_BASE}/api/auth/instagram/status`, () => {
    return HttpResponse.json(mockConnectionStatus);
  }),

  http.get(`${API_BASE}/api/auth/instagram/login`, () => {
    return new HttpResponse(null, {
      status: 302,
      headers: { Location: 'https://www.instagram.com/oauth/authorize' },
    });
  }),

  // Dashboard
  http.get(`${API_BASE}/api/dashboard`, () => {
    return HttpResponse.json(mockDashboardData);
  }),

  http.get(`${API_BASE}/api/dashboard/insight`, () => {
    return HttpResponse.json({
      success: true,
      data: mockDashboardData.data.insight,
    });
  }),

  // Sync
  http.post(`${API_BASE}/api/sync/trigger`, () => {
    return HttpResponse.json({
      success: true,
      data: { syncId: 'sync-1', status: 'started' },
    });
  }),

  http.get(`${API_BASE}/api/sync/status`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        status: 'idle',
        lastSyncAt: new Date().toISOString(),
        mediaCount: 24,
        nextSyncAvailableAt: null,
      },
    });
  }),

  // Media
  http.get(`${API_BASE}/api/media`, ({ request }) => {
    const url = new URL(request.url);
    const typeFilter = url.searchParams.get('type');
    const productTypeFilter = url.searchParams.get('productType');

    const allMedia = [
      {
        id: 'media-reel-1',
        accountId: 'acc-1',
        igMediaId: 'ig-reel-1',
        mediaType: 'VIDEO',
        mediaProductType: 'REELS',
        permalink: 'https://www.instagram.com/p/reel1/',
        caption: 'Mi primer Reel — consejos de crecimiento en Instagram',
        thumbnailUrl: null,
        postedAt: '2026-06-10T14:00:00Z',
        metrics: {
          likes: 320, comments: 45, saves: 89, shares: 52,
          reach: 4200, impressions: 5100, totalInteractions: 506,
          videoViews: 3800, avgWatchTime: 12500, videoViewTotalTime: 47500000,
          syncedAt: new Date().toISOString(),
        },
      },
      {
        id: 'media-reel-2',
        accountId: 'acc-1',
        igMediaId: 'ig-reel-2',
        mediaType: 'VIDEO',
        mediaProductType: 'REELS',
        permalink: 'https://www.instagram.com/p/reel2/',
        caption: 'Tips para crear contenido viral',
        thumbnailUrl: null,
        postedAt: '2026-06-05T10:00:00Z',
        metrics: {
          likes: 180, comments: 22, saves: 41, shares: 28,
          reach: 2100, impressions: 2800, totalInteractions: 271,
          videoViews: 1950, avgWatchTime: 8200, videoViewTotalTime: 15990000,
          syncedAt: new Date().toISOString(),
        },
      },
      {
        id: 'media-image-1',
        accountId: 'acc-1',
        igMediaId: 'ig-image-1',
        mediaType: 'IMAGE',
        mediaProductType: 'FEED',
        permalink: 'https://www.instagram.com/p/image1/',
        caption: 'Fotografía del producto — nueva colección disponible',
        thumbnailUrl: null,
        postedAt: '2026-06-08T09:00:00Z',
        metrics: {
          likes: 240, comments: 18, saves: 67, shares: 35,
          reach: 3100, impressions: 3800, totalInteractions: 360,
          videoViews: null, avgWatchTime: null, videoViewTotalTime: null,
          syncedAt: new Date().toISOString(),
        },
      },
      {
        id: 'media-image-2',
        accountId: 'acc-1',
        igMediaId: 'ig-image-2',
        mediaType: 'IMAGE',
        mediaProductType: 'FEED',
        permalink: 'https://www.instagram.com/p/image2/',
        caption: 'Detrás de cámaras — así trabajamos cada día',
        thumbnailUrl: null,
        postedAt: '2026-06-03T16:00:00Z',
        metrics: {
          likes: 155, comments: 12, saves: 38, shares: 19,
          reach: 1900, impressions: 2300, totalInteractions: 224,
          videoViews: null, avgWatchTime: null, videoViewTotalTime: null,
          syncedAt: new Date().toISOString(),
        },
      },
      {
        id: 'media-carousel-1',
        accountId: 'acc-1',
        igMediaId: 'ig-carousel-1',
        mediaType: 'CAROUSEL_ALBUM',
        mediaProductType: 'FEED',
        permalink: 'https://www.instagram.com/p/carousel1/',
        caption: '5 estrategias que duplicaron mi alcance este mes (deslizá →)',
        thumbnailUrl: null,
        postedAt: '2026-06-12T11:00:00Z',
        metrics: {
          likes: 410, comments: 63, saves: 145, shares: 87,
          reach: 5600, impressions: 6900, totalInteractions: 705,
          videoViews: null, avgWatchTime: null, videoViewTotalTime: null,
          syncedAt: new Date().toISOString(),
        },
      },
      {
        id: 'media-carousel-2',
        accountId: 'acc-1',
        igMediaId: 'ig-carousel-2',
        mediaType: 'CAROUSEL_ALBUM',
        mediaProductType: 'FEED',
        permalink: 'https://www.instagram.com/p/carousel2/',
        caption: 'Guía completa de hashtags para tu nicho — descargá gratis',
        thumbnailUrl: null,
        postedAt: '2026-05-28T13:00:00Z',
        metrics: {
          likes: 290, comments: 41, saves: 112, shares: 65,
          reach: 4100, impressions: 5200, totalInteractions: 508,
          videoViews: null, avgWatchTime: null, videoViewTotalTime: null,
          syncedAt: new Date().toISOString(),
        },
      },
    ];

    let filtered = allMedia;
    if (typeFilter) {
      filtered = allMedia.filter((m) => m.mediaType === typeFilter);
    } else if (productTypeFilter) {
      filtered = allMedia.filter((m) => m.mediaProductType === productTypeFilter);
    }

    return HttpResponse.json({
      success: true,
      data: { data: filtered, total: filtered.length, page: 1, pageSize: 50 },
    });
  }),

  // Growth Agent — Chat
  http.post(`${API_BASE}/api/chat`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        reply: 'Mock reply from agent',
        sessionId: 'mock-session-id',
        suggestions: [],
        toolCallsTrace: [],
      },
    });
  }),

  http.get(`${API_BASE}/api/chat/history`, () => {
    return HttpResponse.json({
      success: true,
      data: [],
    });
  }),

  http.delete(`${API_BASE}/api/chat/messages/:id`, () => {
    return HttpResponse.json({
      success: true,
      data: { deleted: true },
    });
  }),

  http.delete(`${API_BASE}/api/chat/history`, () => {
    return HttpResponse.json({
      success: true,
      data: { deletedCount: 5 },
    });
  }),

  // Growth Agent — Suggestions
  http.get(`${API_BASE}/api/suggestions`, () => {
    return HttpResponse.json({
      success: true,
      data: [],
    });
  }),

  http.post(`${API_BASE}/api/suggestions/:id/mark-used`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: { id: params['id'] },
    });
  }),

  http.post(`${API_BASE}/api/suggestions/:id/dismiss`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: { id: params['id'] },
    });
  }),

  // Auth — Disconnect
  http.post(`${API_BASE}/api/auth/instagram/disconnect`, () => {
    return HttpResponse.json({
      success: true,
      data: { message: 'Cuenta desconectada exitosamente' },
    });
  }),

  // Agent Settings
  http.get(`${API_BASE}/api/agent/settings`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        agentConfig: {
          niche: 'Ferretería',
          tags: ['Ferretería', 'Herramientas'],
        },
      },
    });
  }),

  http.put(`${API_BASE}/api/agent/settings`, () => {
    return HttpResponse.json({
      success: true,
      data: { saved: true },
    });
  }),

  // Usage / Quota
  http.get(`${API_BASE}/api/agent/usage`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        quotas: {
          deepseek_tokens: {
            used: 12000,
            limit: 100000,
            period: 'month',
            resetsAt: '2026-07-01T00:00:00.000Z',
          },
          fal_images: {
            used: 8,
            limit: 50,
            period: 'month',
            resetsAt: '2026-07-01T00:00:00.000Z',
          },
        },
        periodStart: '2026-06-01T00:00:00.000Z',
        periodEnd: '2026-07-01T00:00:00.000Z',
      },
    })
  }),

  // Upload carousel — create
  http.post(`${API_BASE}/api/carousels/upload`, async ({ request }) => {
    const body = await request.json() as { topic: string; slides: Array<{ order: number; imageMode: string }> }
    const slides = (body.slides ?? []).map((s, i) => ({
      id: `upload-slide-${i + 1}`,
      order: s.order,
      status: 'pending',
    }))
    return HttpResponse.json({
      success: true,
      data: { id: 'upload-carousel-1', status: 'pending', slides },
    }, { status: 202 })
  }),

  // Upload slide image
  http.put(`${API_BASE}/api/carousels/:carouselId/slides/:slideId/image`, () => {
    return HttpResponse.json({ success: true, data: { queued: true } }, { status: 202 })
  }),

  // Growth endpoint
  http.get(`${API_BASE}/api/dashboard/growth`, ({ request }) => {
    const url = new URL(request.url);
    const metric = url.searchParams.get('metric') ?? 'followers';
    const period = url.searchParams.get('period') ?? '30d';

    const PERIOD_DAYS: Record<string, number> = {
      all: 730, '1y': 365, '90d': 90, '30d': 30, '7d': 7,
    };
    const days = PERIOD_DAYS[period] ?? 30;

    const baseValues: Record<string, number> = {
      followers: 1250,
      engagement: 4.5,
      reach: 4500,
      impressions: 8000,
      profileViews: 120,
    };
    const base = baseValues[metric] ?? 1250;
    const until = new Date();

    const data = Array.from({ length: days }, (_, i) => {
      const date = new Date(until);
      date.setDate(date.getDate() - (days - 1 - i));
      // Gentle upward trend with mild noise
      const trend = 1 + (i / days) * 0.18;
      const noise = 1 + (Math.sin(i * 0.7) * 0.03);
      return {
        date: date.toISOString(),
        value: Math.round(base * trend * noise * 100) / 100,
      };
    });

    return HttpResponse.json({ success: true, data });
  }),
];
