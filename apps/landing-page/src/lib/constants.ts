// ============================================================
// Navigation
// ============================================================

export const NAV_HEIGHT = 64;

// ============================================================
// Base URL
// ============================================================

export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://corehub.rasen.solutions';

// ============================================================
// Dashboard KPIs (Instagram metrics)
// ============================================================

export const INSTAGRAM_KPIS = [
  { label: 'Followers', value: '24.8K', change: '+12%', positive: true },
  { label: 'Engagement', value: '5.2%', change: '+0.8%', positive: true },
  { label: 'Reach', value: '18.3K', change: '-3%', positive: false },
  { label: 'Posts', value: '142', change: '+8%', positive: true },
] as const;

// ============================================================
// Social Proof Stats
// ============================================================

export const SOCIAL_PROOF_STATS = [
  { label: 'Active Users', value: '10,000+' },
  { label: 'Accounts Analyzed', value: '50,000+' },
  { label: 'Posts Tracked', value: '2M+' },
  { label: 'Countries', value: '30+' },
] as const;

// ============================================================
// Pricing amounts (Instagram plan tiers)
// ============================================================

export const PRICING_AMOUNTS = {
  free: '$0',
  pro: '$15',
  business: '$29',
  agency: '$79',
} as const;
