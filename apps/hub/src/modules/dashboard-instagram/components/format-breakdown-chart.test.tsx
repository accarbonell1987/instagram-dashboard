import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      children,
  };
});

import { FormatBreakdownChart } from './format-breakdown-chart';
import type { FormatBreakdown } from '../types/instagram.types';

const mockBreakdown: FormatBreakdown[] = [
  {
    format: 'IMAGE',
    postCount: 25,
    avgSaves: 42.5,
    avgShares: 15.3,
    avgLikes: 320,
    avgComments: 18,
    avgReach: 1000,
  },
  {
    format: 'CAROUSEL_ALBUM',
    postCount: 10,
    avgSaves: 85.2,
    avgShares: 40.1,
    avgLikes: 450,
    avgComments: 35,
    avgReach: 800,
  },
  {
    format: 'REEL',
    postCount: 15,
    avgSaves: 25.0,
    avgShares: 55.7,
    avgLikes: 280,
    avgComments: 12,
    avgReach: 2000,
  },
];

describe('FormatBreakdownChart', () => {
  it('renders empty state when breakdown is empty', () => {
    render(<FormatBreakdownChart breakdown={[]} />);
    expect(screen.getByText('Rendimiento por formato')).toBeInTheDocument();
    expect(
      screen.getByText(/Sincronizá datos para ver el desglose/),
    ).toBeInTheDocument();
  });

  it('renders title with breakdown data', () => {
    render(<FormatBreakdownChart breakdown={mockBreakdown} />);
    expect(screen.getByText('Rendimiento por formato')).toBeInTheDocument();
  });

  it('renders post count for each format', () => {
    render(<FormatBreakdownChart breakdown={mockBreakdown} />);
    expect(screen.getByText('25 posts')).toBeInTheDocument();
    expect(screen.getByText('10 posts')).toBeInTheDocument();
    expect(screen.getByText('15 posts')).toBeInTheDocument();
  });

  it('renders format labels', () => {
    render(<FormatBreakdownChart breakdown={mockBreakdown} />);
    expect(screen.getByText('Imágenes')).toBeInTheDocument();
    expect(screen.getByText('Carruseles')).toBeInTheDocument();
    expect(screen.getByText('Reels')).toBeInTheDocument();
  });

  it('renders mix comparison section', () => {
    render(<FormatBreakdownChart breakdown={mockBreakdown} />);
    expect(screen.getByText(/Mezcla real vs/)).toBeInTheDocument();
  });

  it('renders without crashing with zero reach', () => {
    const noReach: FormatBreakdown[] = [
      { format: 'IMAGE', postCount: 5, avgSaves: 10, avgShares: 2, avgLikes: 100, avgComments: 5, avgReach: 0 },
    ];
    const { container } = render(<FormatBreakdownChart breakdown={noReach} />);
    expect(container.firstChild).toBeTruthy();
  });
});
