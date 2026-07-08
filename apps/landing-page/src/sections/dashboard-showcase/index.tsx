import { getTranslations } from 'next-intl/server';
import { Card } from '@core/ui';
import { INSTAGRAM_KPIS } from '@/lib/constants';
import { SectionHead } from '@/components/ui/SectionHead';
import { GlowCard } from '@/components/ui/GlowCard';
import { AnimatedSection } from '@/components/layout/AnimatedSection';
import { StackingCards } from './stacking-cards';

// ── Internal: Follower Chart ────────────────────────────────────────
function FollowerChart() {
  return (
    <div className="w-full" aria-hidden="true">
      <svg viewBox="0 0 400 120" className="h-auto w-full" preserveAspectRatio="none">
        {/* Grid lines */}
        <g stroke="rgba(255,255,255,0.06)" strokeWidth="0.5">
          <line x1="0" y1="20" x2="400" y2="20" />
          <line x1="0" y1="40" x2="400" y2="40" />
          <line x1="0" y1="60" x2="400" y2="60" />
          <line x1="0" y1="80" x2="400" y2="80" />
          <line x1="0" y1="100" x2="400" y2="100" />
        </g>

        {/* Gradients */}
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E1306C" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#E1306C" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="chart-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#E1306C" />
            <stop offset="100%" stopColor="#F77737" />
          </linearGradient>
        </defs>

        {/* Area fill (static) */}
        <path
          d="M0,100 Q50,95 80,80 T160,55 T260,45 T340,28 T400,15 L400,120 L0,120 Z"
          fill="url(#chart-fill)"
        />

        {/* Line (animated draw) */}
        <path
          d="M0,100 Q50,95 80,80 T160,55 T260,45 T340,28 T400,15"
          fill="none"
          stroke="url(#chart-stroke)"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="chart-path animate"
        />

        {/* Data points */}
        <circle cx="80" cy="80" r="4" fill="#E1306C" stroke="#0d0d16" strokeWidth="2" />
        <circle cx="160" cy="55" r="5" fill="#F77737" stroke="#0d0d16" strokeWidth="2" />
        <circle cx="260" cy="45" r="4" fill="#E1306C" stroke="#0d0d16" strokeWidth="2" />
        <circle cx="340" cy="28" r="6" fill="#FCAF45" stroke="#0d0d16" strokeWidth="2" />

        {/* Current value label */}
        <rect x="320" y="5" width="80" height="18" rx="4" fill="rgba(227,16,108,0.15)" />
        <text
          x="360"
          y="17"
          textAnchor="middle"
          fill="#FCAF45"
          fontSize="10"
          fontFamily="JetBrains Mono, monospace"
          fontWeight="600"
        >
          24.8K ↑12%
        </text>
      </svg>
    </div>
  );
}

// ── Internal: KPI Cards ─────────────────────────────────────────────
function KpiCards() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden="true">
      {INSTAGRAM_KPIS.map((kpi) => (
        <Card
          key={kpi.label}
          className="rounded-card border border-border-default bg-bg/70 p-3"
        >
          <p className="font-mono text-[10px] uppercase leading-none tracking-wider text-text-mute mb-1.5">
            {kpi.label}
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-lg font-bold leading-none text-text-default">
              {kpi.value}
            </span>
            <span
              className={[
                'font-mono text-xs leading-none',
                kpi.positive ? 'text-[#22c55e]' : 'text-danger',
              ].join(' ')}
            >
              {kpi.change}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Internal: Recent Posts ──────────────────────────────────────────
function RecentPosts() {
  const posts = [
    { thumb: '#', likes: '2.4K', comments: '89', engagement: '4.8%' },
    { thumb: '#', likes: '1.8K', comments: '56', engagement: '3.9%' },
    { thumb: '#', likes: '3.1K', comments: '124', engagement: '5.6%' },
    { thumb: '#', likes: '892', comments: '34', engagement: '2.7%' },
  ];

  return (
    <div aria-hidden="true">
      <p className="font-mono text-[10px] uppercase tracking-wider text-text-mute mb-3">
        Recent Posts
      </p>
      <div className="flex flex-col gap-2">
        {posts.map((post, i) => (
          <div key={i} className="flex items-center gap-3">
            {/* Post thumbnail placeholder */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border-default bg-surface">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="1.5"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
            {/* Engagement stats */}
            <div className="flex flex-1 items-center gap-3 text-xs">
              <span className="font-mono text-text-dim">❤️ {post.likes}</span>
              <span className="font-mono text-text-mute">💬 {post.comments}</span>
              <span
                className={[
                  'ml-auto font-mono text-xs',
                  i === 2 ? 'text-[#22c55e]' : 'text-text-dim',
                ].join(' ')}
              >
                {post.engagement}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Exported Section Component ──────────────────────────────────────
export async function DashboardShowcase() {
  const t = await getTranslations('dashboard');

  const features = [
    {
      title: t('block1Heading'),
      desc: t('block1Body'),
      badge: t('block1Badge'),
    },
    {
      title: t('block2Heading'),
      desc: t('block2Body'),
      badge: t('block2Badge'),
    },
    {
      title: t('block3Heading'),
      desc: t('block3Body'),
      badge: t('block3Badge'),
    },
    {
      title: t('block4Heading'),
      desc: t('block4Body'),
      badge: t('block4Badge'),
    },
  ] as const;

  return (
    <section
      id="dashboard"
      className="noise-overlay relative overflow-hidden bg-gradient-to-b from-[#0a0a0f] via-[#0d0d16] to-[#0a0a0f] py-[var(--spacing-section-y)]"
    >
      <div className="relative z-10 mx-auto max-w-[var(--width-content)] px-[var(--spacing-pad)]">
        {/* ── Two-column: Dashboard mockup + text ── */}
        <div className="flex flex-col items-center gap-12 lg:flex-row lg:gap-16">
          {/* Left: Dashboard mockup */}
          <AnimatedSection
            variant="fadeScale"
            className="w-full flex-shrink-0 lg:w-[48%]"
          >
            <GlowCard
              glowColor="pink"
              className="relative overflow-hidden border p-5 sm:p-6"
            >
              {/* Dashboard header */}
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="font-display text-sm font-semibold text-text-default">
                    Instagram Dashboard
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-text-mute">
                    @yourhandle · Last 30 days
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-pill bg-[#22c55e]/10 px-2.5 py-1 font-mono text-xs text-[#22c55e]">
                    ● Live
                  </span>
                </div>
              </div>

              {/* KPI Cards */}
              <KpiCards />

              {/* Chart */}
              <div className="mt-5 rounded-card border border-border-default bg-bg/50 p-4">
                <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-text-mute">
                  Follower Growth
                </p>
                <FollowerChart />
              </div>

              {/* Recent posts */}
              <div className="mt-4 rounded-card border border-border-default bg-bg/50 p-4">
                <RecentPosts />
              </div>
            </GlowCard>
          </AnimatedSection>

          {/* Right: Heading + lead */}
          <div className="w-full lg:w-[52%]">
            <span className="inline-flex items-center gap-2 font-mono text-xs tracking-widest uppercase text-text-mute">
              <span
                className="inline-block h-2 w-2 rounded-full bg-accent"
                aria-hidden="true"
              />
              {t('eyebrow')}
            </span>

            <SectionHead
              heading={
                <>
                  {t('heading1')}
                  <br />
                  {t('heading2')}{' '}
                  <em className="font-display font-bold not-italic text-accent">
                    {t('heading2Gold')}
                  </em>
                  .
                </>
              }
              lead={t('lead')}
            />
          </div>
        </div>

        {/* ── Sticky stacking feature cards ── */}
        <StackingCards features={features} />
      </div>
    </section>
  );
}
