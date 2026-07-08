import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { PostingHeatmap } from './posting-heatmap';
import type { HeatmapCell } from '../types/instagram.types';

// 16 total posts — enough for the heatmap to render (≥ 8)
const richCells: HeatmapCell[] = [
  { day: 'Mon', dayIndex: 1, slot: '12-18', slotIndex: 2, totalSavesShares: 150, postCount: 5 },
  { day: 'Tue', dayIndex: 2, slot: '06-12', slotIndex: 1, totalSavesShares: 80,  postCount: 3 },
  { day: 'Wed', dayIndex: 3, slot: '18-24', slotIndex: 3, totalSavesShares: 200, postCount: 7 },
  { day: 'Thu', dayIndex: 4, slot: '00-06', slotIndex: 0, totalSavesShares: 10,  postCount: 1 },
];

// 5 total posts — insufficient data state (< 8)
const fewCells: HeatmapCell[] = [
  { day: 'Mon', dayIndex: 1, slot: '12-18', slotIndex: 2, totalSavesShares: 150, postCount: 2 },
  { day: 'Tue', dayIndex: 2, slot: '06-12', slotIndex: 1, totalSavesShares: 80,  postCount: 3 },
];

describe('PostingHeatmap', () => {
  describe('insufficient-data state', () => {
    it('shows insufficient-data state when cells array is empty', () => {
      render(<PostingHeatmap cells={[]} />);
      expect(screen.getByText(/mejor ventana/)).toBeInTheDocument();
      expect(screen.getByText('Sin datos aún.')).toBeInTheDocument();
    });

    it('shows post count and threshold message when some posts but below minimum', () => {
      render(<PostingHeatmap cells={fewCells} />);
      // 2+3 = 5 posts → insufficient
      expect(screen.getByText(/5 posts registrados/)).toBeInTheDocument();
      expect(screen.getByText(/Se necesitan al menos/)).toBeInTheDocument();
    });

    it('renders title in insufficient-data state', () => {
      render(<PostingHeatmap cells={[]} />);
      expect(screen.getByText('Mejores Horarios para Publicar')).toBeInTheDocument();
    });
  });

  describe('heatmap state', () => {
    it('renders title', () => {
      render(<PostingHeatmap cells={richCells} />);
      expect(screen.getByText('Mejores Horarios para Publicar')).toBeInTheDocument();
    });

    it('renders day labels', () => {
      render(<PostingHeatmap cells={richCells} />);
      expect(screen.getByText('Lun')).toBeInTheDocument();
      expect(screen.getByText('Mar')).toBeInTheDocument();
    });

    it('renders named time-window slot labels instead of raw ranges', () => {
      render(<PostingHeatmap cells={richCells} />);
      expect(screen.getByText('Madrugada')).toBeInTheDocument();
      expect(screen.getByText('Mañana')).toBeInTheDocument();
      expect(screen.getByText('Tarde')).toBeInTheDocument();
      expect(screen.getByText('Noche')).toBeInTheDocument();
    });

    it('shows time ranges as subtitles under slot labels', () => {
      render(<PostingHeatmap cells={richCells} />);
      expect(screen.getByText('00–06')).toBeInTheDocument();
      expect(screen.getByText('12–18')).toBeInTheDocument();
    });

    it('shows Reels note about algorithm distribution', () => {
      render(<PostingHeatmap cells={richCells} />);
      expect(screen.getByText('Reels:')).toBeInTheDocument();
      expect(screen.getByText(/algoritmo/)).toBeInTheDocument();
    });

    it('shows microcopy framing timing as secondary lever', () => {
      render(<PostingHeatmap cells={richCells} />);
      expect(screen.getByText(/consistencia/)).toBeInTheDocument();
      expect(screen.getByText(/multiplicador/)).toBeInTheDocument();
    });

    it('shows post counts in cells, not exact save+share values', () => {
      render(<PostingHeatmap cells={richCells} />);
      // postCount values: 5, 3, 7, 1
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('7')).toBeInTheDocument();
      // totalSavesShares (150, 80, 200, 10) should NOT appear
      expect(screen.queryByText('150')).not.toBeInTheDocument();
      expect(screen.queryByText('200')).not.toBeInTheDocument();
    });

    it('shows low-confidence indicator for cells with fewer than 3 posts', () => {
      render(<PostingHeatmap cells={richCells} />);
      // postCount=1 cell (Thu, Madrugada) → renders ~
      const lowConfidenceMarkers = screen.getAllByText('~');
      expect(lowConfidenceMarkers.length).toBeGreaterThan(0);
    });

    it('renders legend with color scale labels', () => {
      render(<PostingHeatmap cells={richCells} />);
      expect(screen.getByText('Menos')).toBeInTheDocument();
      expect(screen.getByText(/Más saves/)).toBeInTheDocument();
    });

    it('renders title attribute on cells for tooltip context', () => {
      render(<PostingHeatmap cells={richCells} />);
      const cellsWithTitle = document.querySelectorAll('[title]');
      // All 28 grid cells have title attributes
      expect(cellsWithTitle.length).toBe(28);
    });
  });
});
