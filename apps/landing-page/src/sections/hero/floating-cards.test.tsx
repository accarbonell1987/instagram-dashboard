import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FloatingCard } from './floating-cards';

describe('FloatingCard', () => {
  it('renders children', () => {
    render(
      <FloatingCard>
        <span data-testid="card-content">Followers: 12.4K</span>
      </FloatingCard>,
    );
    expect(screen.getByTestId('card-content')).toBeInTheDocument();
    expect(screen.getByTestId('card-content')).toHaveTextContent('Followers: 12.4K');
  });

  it('applies custom className', () => {
    const { container } = render(
      <FloatingCard className="absolute top-10 left-10">
        <span>Content</span>
      </FloatingCard>,
    );
    const el = container.firstElementChild;
    expect(el).not.toBeNull();
    expect(el!.className).toContain('absolute');
    expect(el!.className).toContain('top-10');
    expect(el!.className).toContain('left-10');
  });

  it('accepts speed and offset props without error', () => {
    render(
      <FloatingCard speed={0.3} offset={50}>
        <span>Custom Parallax</span>
      </FloatingCard>,
    );
    expect(screen.getByText('Custom Parallax')).toBeInTheDocument();
  });

  it('renders multiple cards independently', () => {
    render(
      <>
        <FloatingCard speed={0.2} className="top-0">
          <span>Card 1</span>
        </FloatingCard>
        <FloatingCard speed={0.4} className="bottom-0">
          <span>Card 2</span>
        </FloatingCard>
      </>
    );
    expect(screen.getByText('Card 1')).toBeInTheDocument();
    expect(screen.getByText('Card 2')).toBeInTheDocument();
  });
});
