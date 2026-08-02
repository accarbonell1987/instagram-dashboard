import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Recharts to avoid ResponsiveContainer dimension issues in jsdom
vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      children,
  };
});

// Mock hooks — the page component imports them directly
vi.mock('./hooks/use-instagram-dashboard', () => ({
  useInstagramDashboard: vi.fn(),
  useConnectionStatus: vi.fn(),
  useSyncStatus: vi.fn(),
  useGrowthData: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
  usePublications: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
  useReels: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
  useReelDetail: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
  useDemographics: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

// Mock the growth agent hook so it doesn't call the instagram service
vi.mock('./hooks/use-growth-agent', () => ({
  useGrowthAgent: vi.fn(() => ({
    messages: [],
    suggestions: [],
    suggestionBatches: [],
    isLoading: false,
    sessionId: 'mock-session',
    error: null,
    sendMessage: vi.fn(),
    markUsed: vi.fn(),
    dismiss: vi.fn(),
  })),
}));

// Mock FloatingAgent — it uses lucide-react icons and complex interactivity;
// the page test only needs to verify the page-level layout and state machine,
// not the widget internals (those are covered by floating-agent.test.tsx).
vi.mock('./components/floating-agent', () => ({
  FloatingAgent: () => <div data-testid="floating-agent" />,
}));

// Mock the Instagram service for ConnectAccount and DisconnectButton
vi.mock('./services/instagram.service', () => ({
  getOAuthUrl: vi.fn(() => 'https://instagram.com/oauth'),
  getGrowthData: vi.fn().mockResolvedValue([]),
  getSuggestions: vi.fn().mockResolvedValue([]),
  sendChatMessage: vi.fn().mockResolvedValue({ reply: '', sessionId: '', suggestions: [], toolCallsTrace: [] }),
  getChatHistory: vi.fn().mockResolvedValue([]),
  markSuggestionUsed: vi.fn().mockResolvedValue(undefined),
  dismissSuggestion: vi.fn().mockResolvedValue(undefined),
}));

// Mock SyncStatusBadge — uses Radix Tooltip which needs provider in tests
vi.mock('./components/sync-status-badge', () => ({
  SyncStatusBadge: () => <div data-testid="sync-status-badge" />,
}));

import {
  useInstagramDashboard,
  useConnectionStatus,
  useSyncStatus,
} from './hooks/use-instagram-dashboard';
import { DashboardInstagramPage } from './page';
import type {
  DashboardData,
  InstagramPeriod,
  SyncState,
} from './types/instagram.types';


function mockDashboardHook(overrides: Partial<ReturnType<typeof useInstagramDashboard>> = {}) {
  const defaults = {
    data: null as DashboardData | null,
    isLoading: false,
    error: null as string | null,
    period: '7d' as InstagramPeriod,
    setPeriod: vi.fn(),
    refetch: vi.fn(),
  };
  const mock = { ...defaults, ...overrides };
  vi.mocked(useInstagramDashboard).mockReturnValue(mock);
  return mock;
}

function mockConnectionHook(overrides: Partial<ReturnType<typeof useConnectionStatus>> = {}) {
  const defaults = {
    isConnected: false,
    username: null as string | null,
    isLoading: false,
    error: null as string | null,
    refetch: vi.fn(),
  };
  const mock = { ...defaults, ...overrides };
  vi.mocked(useConnectionStatus).mockReturnValue(mock);
  return mock;
}

function mockSyncHook(overrides: Partial<ReturnType<typeof useSyncStatus>> = {}) {
  const defaults = {
    syncState: null as SyncState | null,
    isLoading: false,
    triggerSync: vi.fn(),
    isTriggering: false,
  };
  const mock = { ...defaults, ...overrides };
  vi.mocked(useSyncStatus).mockReturnValue(mock);
  return mock;
}

// The page maps its view model from the backend response shape (`account`,
// `overview`, `ranking`…), casting `data` internally. The fixture mirrors that
// shape; the legacy `profile`/`overview` fields are kept for the type.
const mockDashboardData = {
  account: {
    username: 'testuser',
    displayName: 'Test User',
    profilePictureUrl: 'https://example.com/avatar.jpg',
    accountType: 'BUSINESS',
    followerCount: 1000,
    mediaCount: 50,
  },
  profile: {
    username: 'testuser',
    fullName: 'Test User',
    avatarUrl: 'https://example.com/avatar.jpg',
    bio: 'Test bio',
    website: undefined,
    isVerified: false,
    isBusiness: true,
    followersCount: 1000,
    followingCount: 500,
    postsCount: 50,
  },
  overview: {
    followers: { current: 1000, previous: 950, trend: 'up', percentageChange: 5.2 },
    engagement: { current: 3500, previous: 3200, trend: 'up', percentageChange: 9.3 },
    reach: { current: 12000, previous: 11000, trend: 'up', percentageChange: 9.0 },
    impressions: { current: 25000, previous: 24000, trend: 'up', percentageChange: 4.1 },
    profileViews: { current: 3000, previous: 2800, trend: 'up', percentageChange: 7.1 },
  },
  engagementHistory: [],
  topPosts: [],
  recentPosts: [],
  audience: {
    ageRanges: [],
    topCities: [],
    topCountries: [],
    genderSplit: { male: 40, female: 55, other: 5 },
  },
  period: '7d',
  lastUpdated: '2026-06-10T10:00:00Z',
} as unknown as DashboardData;

describe('DashboardInstagramPage — state machine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('STATE 1: Checking connection', () => {
    it('renders "Verificando conexión" while checking', () => {
      mockConnectionHook({ isConnected: false, isLoading: true });
      mockDashboardHook();
      mockSyncHook();

      render(<DashboardInstagramPage />);

      expect(
        screen.getByText('Verificando conexión con Instagram...'),
      ).toBeInTheDocument();
    });

    it('does not show dashboard content while checking', () => {
      mockConnectionHook({ isConnected: false, isLoading: true });
      mockDashboardHook({ data: mockDashboardData, isLoading: false });

      render(<DashboardInstagramPage />);

      expect(
        screen.queryByText('Test User'),
      ).not.toBeInTheDocument();
    });
  });

  describe('STATE 2: Not connected', () => {
    it('renders ConnectAccount when not connected', () => {
      mockConnectionHook({ isConnected: false, isLoading: false });
      mockDashboardHook();
      mockSyncHook();

      render(<DashboardInstagramPage />);

      expect(
        screen.getByText('Conectá tu cuenta de Instagram'),
      ).toBeInTheDocument();
    });
  });

  describe('STATE 3: Loading dashboard', () => {
    it('renders skeleton while loading', () => {
      mockConnectionHook({ isConnected: true, isLoading: false });
      mockDashboardHook({ isLoading: true });
      mockSyncHook();

      const { container } = render(<DashboardInstagramPage />);

      // Loading state renders ScorecardsSkeleton — verify it mounts
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('STATE 4: Error', () => {
    it('renders error message', () => {
      mockConnectionHook({ isConnected: true, isLoading: false });
      mockDashboardHook({ error: 'Network failure' });
      mockSyncHook();

      render(<DashboardInstagramPage />);

      expect(screen.getByText('Error al cargar el dashboard')).toBeInTheDocument();
      expect(screen.getByText('Network failure')).toBeInTheDocument();
    });

    it('renders retry button', () => {
      const refetch = vi.fn();
      mockConnectionHook({ isConnected: true, isLoading: false });
      mockDashboardHook({ error: 'Error', refetch });
      mockSyncHook();

      render(<DashboardInstagramPage />);

      expect(screen.getByText('Reintentar')).toBeInTheDocument();
    });
  });

  describe('STATE 5: No data yet', () => {
    it('renders "Cuenta conectada" when no data', () => {
      mockConnectionHook({ isConnected: true, isLoading: false });
      mockDashboardHook({ data: null, isLoading: false, error: null });
      mockSyncHook({
        syncState: { status: 'syncing', lastSyncAt: null, mediaCount: 0, nextSyncAvailableAt: null },
      });

      render(<DashboardInstagramPage />);

      expect(screen.getByText('Cuenta conectada')).toBeInTheDocument();
    });
  });

  describe('STATE 6: Full dashboard', () => {
    it('renders profile header', () => {
      mockConnectionHook({ isConnected: true, isLoading: false });
      mockDashboardHook({ data: mockDashboardData, isLoading: false, error: null });
      mockSyncHook({
        syncState: { status: 'idle', lastSyncAt: '2026-06-10T10:00:00Z', mediaCount: 50, nextSyncAvailableAt: null },
      });

      render(<DashboardInstagramPage />);

      expect(screen.getAllByText('Test User').length).toBeGreaterThan(0);
    });

    it('renders last updated timestamp', () => {
      mockConnectionHook({ isConnected: true, isLoading: false });
      mockDashboardHook({ data: mockDashboardData, isLoading: false, error: null });
      mockSyncHook({
        syncState: { status: 'idle', lastSyncAt: '2026-06-10T10:00:00Z', mediaCount: 50, nextSyncAvailableAt: null },
      });

      render(<DashboardInstagramPage />);

      expect(screen.getByText(/Última actualización:/)).toBeInTheDocument();
    });

  });
});
