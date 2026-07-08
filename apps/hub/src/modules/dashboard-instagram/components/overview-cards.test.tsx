import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OverviewCards } from './overview-cards';
import type { OverviewStats } from '../types/instagram.types';

function createStats(overrides: Partial<OverviewStats> = {}): OverviewStats {
  return {
    followers: { current: 1250, previous: 1200, trend: 'up', percentageChange: 4.2 },
    engagement: { current: 342, previous: 300, trend: 'up', percentageChange: 14 },
    reach: { current: 8900, previous: 8000, trend: 'up', percentageChange: 11.2 },
    impressions: { current: 12500, previous: 11000, trend: 'up', percentageChange: 13.6 },
    profileViews: { current: 450, previous: 400, trend: 'up', percentageChange: 12.5 },
    ...overrides,
  };
}

describe('OverviewCards', () => {
  it('renders all 5 metric cards', () => {
    render(<OverviewCards stats={createStats()} />);
    expect(screen.getByText('Seguidores')).toBeInTheDocument();
    expect(screen.getByText('Engagement')).toBeInTheDocument();
    expect(screen.getByText('Alcance')).toBeInTheDocument();
    expect(screen.getByText('Impresiones')).toBeInTheDocument();
    expect(screen.getByText('Visitas al perfil')).toBeInTheDocument();
  });

  it('renders formatted metric values', () => {
    render(<OverviewCards stats={createStats()} />);
    // 1250 → "1.3K"
    expect(screen.getByText('1.3K')).toBeInTheDocument();
  });

  it('renders sparkline SVG when trends are provided with ≥2 points', () => {
    const trends = {
      followers: [1200, 1225, 1240, 1250],
    };
    const { container } = render(
      <OverviewCards stats={createStats()} trends={trends} />,
    );
    // The sparkline renders inside a recharts-wrapper
    const wrapper = container.querySelector('.recharts-wrapper');
    expect(wrapper).toBeTruthy();
  });

  it('hides sparkline when less than 2 data points', () => {
    const trends = { followers: [1200] };
    const { container } = render(
      <OverviewCards stats={createStats()} trends={trends} />,
    );
    // With only 1 data point, sparkline should NOT render
    const wrappers = container.querySelectorAll('.recharts-wrapper');
    expect(wrappers.length).toBe(0);
  });

  it('does not render sparklines when trends prop is not provided', () => {
    const { container } = render(<OverviewCards stats={createStats()} />);
    const wrappers = container.querySelectorAll('.recharts-wrapper');
    expect(wrappers.length).toBe(0);
  });

  it('renders green sparkline for upward trend', () => {
    const trends = { engagement: [100, 120, 150] };
    const { container } = render(
      <OverviewCards stats={createStats()} trends={trends} />,
    );
    // Sparkline should have green stroke (#22c55e) for upward trend
    const sparklinePath = container.querySelector('.recharts-line-curve');
    expect(sparklinePath).toBeTruthy();
    const stroke = sparklinePath?.getAttribute('stroke');
    expect(stroke).toBe('#22c55e');
  });

  it('renders red sparkline for downward trend', () => {
    const trends = { followers: [1250, 1200, 1150] };
    const { container } = render(
      <OverviewCards stats={createStats()} trends={trends} />,
    );
    const sparklinePath = container.querySelector('.recharts-line-curve');
    expect(sparklinePath).toBeTruthy();
    const stroke = sparklinePath?.getAttribute('stroke');
    expect(stroke).toBe('#ef4444');
  });

  it('renders gray sparkline for flat trend', () => {
    const trends = { reach: [1000, 1000, 1000] };
    const { container } = render(
      <OverviewCards stats={createStats()} trends={trends} />,
    );
    const sparklinePath = container.querySelector('.recharts-line-curve');
    expect(sparklinePath).toBeTruthy();
    const stroke = sparklinePath?.getAttribute('stroke');
    expect(stroke).toBe('#6b7280');
  });

  it('renders multiple sparklines when multiple trends provided', () => {
    const trends = {
      followers: [1200, 1250],
      reach: [8000, 8500],
    };
    const { container } = render(
      <OverviewCards stats={createStats()} trends={trends} />,
    );
    const wrappers = container.querySelectorAll('.recharts-wrapper');
    expect(wrappers.length).toBe(2);
  });

  it('renders trend icons correctly', () => {
    const stats = createStats();
    render(<OverviewCards stats={stats} />);
    // Should have up arrows for all positive trends
    const upArrows = document.querySelectorAll('.text-green-500');
    expect(upArrows.length).toBe(5);
  });
});
