import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { InsightCard } from './insight-card';
import type { InsightResult } from '../types/instagram.types';

const mockInsight: InsightResult = {
  insight: 'Tus Reels generan 3× más saves que las imágenes estáticas.',
  generatedAt: '2026-06-10T10:00:00Z',
};

describe('InsightCard', () => {
  it('renders empty message when no insight provided', () => {
    render(<InsightCard />);
    expect(
      screen.getByText(/Sincronizá más publicaciones/),
    ).toBeInTheDocument();
  });

  it('renders empty message when insight has no insight text', () => {
    render(
      <InsightCard
        insight={{ insight: '', generatedAt: '2026-06-10T10:00:00Z' }}
      />,
    );
    expect(
      screen.getByText(/Sincronizá más publicaciones/),
    ).toBeInTheDocument();
  });

  it('renders the insight text', () => {
    render(<InsightCard insight={mockInsight} />);
    expect(screen.getByText(mockInsight.insight)).toBeInTheDocument();
  });

  it('renders the generation timestamp', () => {
    render(<InsightCard insight={mockInsight} />);
    expect(screen.getByText(/Generado:/)).toBeInTheDocument();
  });
});
