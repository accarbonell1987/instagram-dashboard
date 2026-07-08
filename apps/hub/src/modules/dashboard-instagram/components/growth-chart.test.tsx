import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GrowthChart } from './growth-chart';
import type { GrowthDataPoint } from '../types/instagram.types';

// Recharts renders SVG; ResponsiveContainer needs a width/height in JSDOM
// so we wrap in a fixed-size container.
function renderWithWidth(ui: React.ReactElement) {
  return render(<div style={{ width: 600, height: 400 }}>{ui}</div>);
}

const noop = vi.fn();

const sampleData: GrowthDataPoint[] = [
  { date: '2026-06-15T10:00:00.000Z', value: 1000 },
  { date: '2026-06-16T10:00:00.000Z', value: 1050 },
  { date: '2026-06-17T10:00:00.000Z', value: 1100 },
];

const defaultProps = { period: 'all' as const, onPeriodChange: noop };

describe('GrowthChart', () => {
  it('renders metric title', () => {
    renderWithWidth(<GrowthChart data={sampleData} metric="followers" {...defaultProps} />);
    expect(screen.getByText('Seguidores')).toBeInTheDocument();
  });

  it('renders engagement metric label', () => {
    renderWithWidth(
      <GrowthChart
        data={[{ date: '2026-06-15T10:00:00.000Z', value: 4.5 }]}
        metric="engagement"
        {...defaultProps}
      />,
    );
    expect(screen.getByText('Engagement')).toBeInTheDocument();
  });

  it('renders reach metric label', () => {
    renderWithWidth(
      <GrowthChart
        data={[{ date: '2026-06-15T10:00:00.000Z', value: 500 }]}
        metric="reach"
        {...defaultProps}
      />,
    );
    expect(screen.getByText('Alcance')).toBeInTheDocument();
  });

  it('shows empty state when data is empty', () => {
    renderWithWidth(<GrowthChart data={[]} metric="followers" {...defaultProps} />);
    expect(screen.getByText('Sin datos históricos aún')).toBeInTheDocument();
  });

  it('shows empty state when data is undefined', () => {
    // @ts-expect-error - testing undefined data
    renderWithWidth(<GrowthChart data={undefined} metric="followers" {...defaultProps} />);
    expect(screen.getByText('Sin datos históricos aún')).toBeInTheDocument();
  });

  it('shows loading skeleton when isLoading is true', () => {
    renderWithWidth(
      <GrowthChart data={[]} metric="followers" isLoading={true} {...defaultProps} />,
    );
    const pulseElements = document.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('renders recharts container when data exists', () => {
    const { container } = renderWithWidth(
      <GrowthChart data={sampleData} metric="followers" {...defaultProps} />,
    );
    expect(container.querySelector('.recharts-responsive-container')).toBeTruthy();
  });

  it('renders zoom selector buttons', () => {
    renderWithWidth(<GrowthChart data={sampleData} metric="followers" {...defaultProps} />);
    expect(screen.getByText('Todo')).toBeInTheDocument();
    expect(screen.getByText('90d')).toBeInTheDocument();
    expect(screen.getByText('30d')).toBeInTheDocument();
    expect(screen.getByText('7d')).toBeInTheDocument();
  });
});
