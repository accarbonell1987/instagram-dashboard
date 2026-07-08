import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { TopPostsRanking } from './top-posts-ranking';
import type { TopPost } from '../types/instagram.types';

function makePost(overrides: Partial<TopPost> & Pick<TopPost, 'igMediaId'>): TopPost {
  return {
    id: `uuid-${overrides.igMediaId}`,
    mediaType: 'IMAGE',
    permalink: `https://instagram.com/p/${overrides.igMediaId}`,
    caption: null,
    thumbnailUrl: null,
    postedAt: '2026-06-01T10:00:00Z',
    saves: 50,
    shares: 20,
    likes: 100,
    comments: 10,
    reach: 1000,
    totalEngagement: 70,
    ...overrides,
  };
}

const mockRanking: TopPost[] = [
  makePost({
    igMediaId: '1',
    caption: 'Mi primera publicación',
    mediaType: 'IMAGE',
    saves: 120,
    shares: 45,
    likes: 200,
    comments: 30,
    reach: 2000,
    totalEngagement: 165,
  }),
  makePost({
    igMediaId: '2',
    caption: 'Carrusel de productos',
    mediaType: 'CAROUSEL_ALBUM',
    saves: 200,
    shares: 80,
    likes: 300,
    comments: 50,
    reach: 3000,
    totalEngagement: 280,
  }),
  makePost({
    igMediaId: '3',
    caption: 'Reel promocional',
    mediaType: 'VIDEO',
    saves: 90,
    shares: 30,
    likes: 150,
    comments: 20,
    reach: 1500,
    totalEngagement: 120,
  }),
];

describe('TopPostsRanking', () => {
  describe('empty state', () => {
    it('renders empty state when ranking is empty', () => {
      render(<TopPostsRanking ranking={[]} />);
      expect(screen.getByText('Top Publicaciones')).toBeInTheDocument();
      expect(screen.getByText(/Conectá tu cuenta y sincronizá/)).toBeInTheDocument();
    });

    it('renders empty state when ranking is undefined', () => {
      // @ts-expect-error testing undefined case
      render(<TopPostsRanking ranking={undefined} />);
      expect(screen.getByText('Top Publicaciones')).toBeInTheDocument();
    });
  });

  describe('with data', () => {
    it('renders adaptive title with actual post count', () => {
      render(<TopPostsRanking ranking={mockRanking} />);
      // 3 posts → "Top 3 — Saves + Shares"
      expect(screen.getByText('Top 3 — Saves + Shares')).toBeInTheDocument();
    });

    it('shows post count label', () => {
      render(<TopPostsRanking ranking={mockRanking} />);
      expect(screen.getByText(/3 publicaciones/)).toBeInTheDocument();
    });

    it('renders all 3 sort mode toggles', () => {
      render(<TopPostsRanking ranking={mockRanking} />);
      expect(screen.getByRole('button', { name: 'Absoluto' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Por reach' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Score' })).toBeInTheDocument();
    });

    it('defaults to absolute sort mode', () => {
      render(<TopPostsRanking ranking={mockRanking} />);
      const absoluteButton = screen.getByRole('button', { name: 'Absoluto' });
      expect(absoluteButton.getAttribute('aria-pressed')).toBe('true');
    });

    it('switching to Por reach updates aria-pressed', () => {
      render(<TopPostsRanking ranking={mockRanking} />);
      const efficiencyButton = screen.getByRole('button', { name: 'Por reach' });
      fireEvent.click(efficiencyButton);
      expect(efficiencyButton.getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByRole('button', { name: 'Absoluto' }).getAttribute('aria-pressed')).toBe('false');
    });

    it('renders ranked items as a list', () => {
      render(<TopPostsRanking ranking={mockRanking} />);
      const list = screen.getByRole('list');
      expect(list.children.length).toBe(3);
    });

    it('items with permalink are clickable links', () => {
      render(<TopPostsRanking ranking={mockRanking} />);
      const links = screen.getAllByRole('link');
      // All 3 items have permalinks
      expect(links.length).toBe(3);
      expect(links[0].getAttribute('target')).toBe('_blank');
    });

    it('items without permalink are not clickable', () => {
      const withNullPermalink = [makePost({ igMediaId: '99', permalink: null })];
      render(<TopPostsRanking ranking={withNullPermalink} />);
      expect(screen.queryByRole('link')).toBeNull();
    });

    it('shows rank position numbers', () => {
      render(<TopPostsRanking ranking={mockRanking} />);
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('shows thumbnail image when thumbnailUrl is provided', () => {
      const withThumb = [makePost({ igMediaId: '1', thumbnailUrl: 'https://example.com/thumb.jpg' })];
      const { container } = render(<TopPostsRanking ranking={withThumb} />);
      // alt="" makes role=presentation — query directly
      const img = container.querySelector('img');
      expect(img).not.toBeNull();
      expect(img?.getAttribute('src')).toBe('https://example.com/thumb.jpg');
    });

    it('shows text placeholder when thumbnailUrl is null', () => {
      const withNoThumb = [makePost({ igMediaId: '1', thumbnailUrl: null, mediaType: 'IMAGE' })];
      render(<TopPostsRanking ranking={withNoThumb} />);
      expect(screen.queryByRole('img')).toBeNull();
      // "I" for Imagen
      expect(screen.getByText('I')).toBeInTheDocument();
    });

    it('renders commonality finding when 2+ posts', () => {
      render(<TopPostsRanking ranking={mockRanking} />);
      expect(screen.getByText('Qué comparten los mejores')).toBeInTheDocument();
    });

    it('sorts by absolute value by default (highest totalEngagement first)', () => {
      render(<TopPostsRanking ranking={mockRanking} />);
      const links = screen.getAllByRole('link');
      // Post 2 has totalEngagement 280 — should be first
      expect(links[0].getAttribute('aria-label')).toMatch(/Carrusel de productos/);
    });

    it('re-sorts when switching to score mode', () => {
      render(<TopPostsRanking ranking={mockRanking} />);
      fireEvent.click(screen.getByRole('button', { name: 'Score' }));
      // Post 2: (200×3)+(80×3)+(50×2)+(300×1) = 600+240+100+300 = 1240
      // Post 1: (120×3)+(45×3)+(30×2)+(200×1) = 360+135+60+200 = 755
      // Post 3: (90×3)+(30×3)+(20×2)+(150×1) = 270+90+40+150 = 550
      // Post 2 should still be first
      const links = screen.getAllByRole('link');
      expect(links[0].getAttribute('aria-label')).toMatch(/Carrusel/);
    });
  });
});
