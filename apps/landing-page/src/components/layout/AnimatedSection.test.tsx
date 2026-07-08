import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnimatedSection } from './AnimatedSection';

describe('AnimatedSection', () => {
  it('renders children', () => {
    render(
      <AnimatedSection>
        <p data-testid="child">Hello</p>
      </AnimatedSection>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toHaveTextContent('Hello');
  });

  it('renders children content correctly', () => {
    render(
      <AnimatedSection>
        <span>Section Content</span>
      </AnimatedSection>,
    );
    expect(screen.getByText('Section Content')).toBeInTheDocument();
  });

  it('uses the `as` prop when reduced motion is active', () => {
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

    const { container } = render(
      <AnimatedSection as="section" data-testid="wrapper">
        <span>Reduced</span>
      </AnimatedSection>,
    );
    const section = container.querySelector('section');
    expect(section).toBeInTheDocument();
    expect(section).toHaveTextContent('Reduced');
  });

  it('applies className to the wrapper', () => {
    const { container } = render(
      <AnimatedSection className="test-class another-class">
        <span>Content</span>
      </AnimatedSection>,
    );
    const el = container.firstElementChild;
    expect(el).toHaveClass('test-class');
    expect(el).toHaveClass('another-class');
  });

  it('renders as plain element when reduced motion is active', () => {
    // Override matchMedia to simulate reduced motion
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

    const { container } = render(
      <AnimatedSection as="article">
        <span>Reduced</span>
      </AnimatedSection>,
    );

    const article = container.querySelector('article');
    expect(article).toBeInTheDocument();
  });
});
