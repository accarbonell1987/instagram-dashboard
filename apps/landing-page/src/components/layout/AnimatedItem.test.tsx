import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnimatedItem } from './AnimatedItem';

describe('AnimatedItem', () => {
  it('renders children', () => {
    render(
      <AnimatedItem>
        <p data-testid="item-child">Item Content</p>
      </AnimatedItem>,
    );
    expect(screen.getByTestId('item-child')).toBeInTheDocument();
    expect(screen.getByTestId('item-child')).toHaveTextContent('Item Content');
  });

  it('applies className to the wrapper', () => {
    const { container } = render(
      <AnimatedItem className="item-class custom">
        <span>Content</span>
      </AnimatedItem>,
    );
    const el = container.firstElementChild;
    expect(el).toHaveClass('item-class');
    expect(el).toHaveClass('custom');
  });

  it('renders plain div when reduced motion is active', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(
      <AnimatedItem variant="fadeUp">
        <span>Reduced</span>
      </AnimatedItem>,
    );

    expect(screen.getByText('Reduced')).toBeInTheDocument();
  });

  it('renders with fadeUp variant', () => {
    render(
      <AnimatedItem variant="fadeUp">
        <span>fadeUp</span>
      </AnimatedItem>,
    );
    expect(screen.getByText('fadeUp')).toBeInTheDocument();
  });

  it('renders with fadeLeft variant', () => {
    render(
      <AnimatedItem variant="fadeLeft">
        <span>fadeLeft</span>
      </AnimatedItem>,
    );
    expect(screen.getByText('fadeLeft')).toBeInTheDocument();
  });

  it('renders with fadeRight variant', () => {
    render(
      <AnimatedItem variant="fadeRight">
        <span>fadeRight</span>
      </AnimatedItem>,
    );
    expect(screen.getByText('fadeRight')).toBeInTheDocument();
  });

  it('renders with fadeScale variant', () => {
    render(
      <AnimatedItem variant="fadeScale">
        <span>fadeScale</span>
      </AnimatedItem>,
    );
    expect(screen.getByText('fadeScale')).toBeInTheDocument();
  });
});
