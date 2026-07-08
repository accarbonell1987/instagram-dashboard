import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnimatedText } from './AnimatedText';

function mockMatchMedia(matchesMap: Record<string, boolean>) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: matchesMap[query] ?? false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('AnimatedText', () => {
  beforeEach(() => {
    // Default: no reduced motion, not mobile → animated mode
    mockMatchMedia({
      '(prefers-reduced-motion: reduce)': false,
      '(max-width: 767px)': false,
    });
  });

  it('renders text content inside an sr-only span for accessibility', () => {
    render(<AnimatedText text="Hello World" />);
    const srSpan = document.querySelector('.sr-only');
    expect(srSpan).toBeInTheDocument();
    expect(srSpan).toHaveTextContent('Hello World');
  });

  it('renders as a <p> tag by default', () => {
    const { container } = render(<AnimatedText text="Default paragraph" />);
    const p = container.querySelector('p');
    expect(p).toBeInTheDocument();
    expect(p).toHaveTextContent('Default paragraph');
  });

  it('renders as the specified HTML element via the as prop', () => {
    const { container } = render(<AnimatedText text="Heading" as="h2" />);
    const h2 = container.querySelector('h2');
    expect(h2).toBeInTheDocument();
    expect(h2).toHaveTextContent('Heading');
  });

  it('renders as <span> when as="span"', () => {
    const { container } = render(<AnimatedText text="inline" as="span" />);
    const span = container.querySelector('span');
    expect(span).toBeInTheDocument();
    expect(span).toHaveTextContent('inline');
  });

  it('applies className to the wrapper element', () => {
    const { container } = render(
      <AnimatedText text="Styled" className="text-lg font-bold" />,
    );
    const p = container.querySelector('p');
    expect(p).toHaveClass('text-lg');
    expect(p).toHaveClass('font-bold');
  });

  it('renders plain text when reduced motion is preferred', () => {
    mockMatchMedia({
      '(prefers-reduced-motion: reduce)': true,
      '(max-width: 767px)': false,
    });

    const { container } = render(<AnimatedText text="No animation" />);
    const p = container.querySelector('p');
    expect(p).toBeInTheDocument();
    expect(p).toHaveTextContent('No animation');
    // Should be a plain tag with no motion.span children and no sr-only
    const srSpan = container.querySelector('.sr-only');
    expect(srSpan).toBeNull();
  });

  it('renders plain text on mobile (viewport width ≤767px)', () => {
    mockMatchMedia({
      '(prefers-reduced-motion: reduce)': false,
      '(max-width: 767px)': true,
    });

    const { container } = render(<AnimatedText text="Mobile fallback" />);
    const p = container.querySelector('p');
    expect(p).toBeInTheDocument();
    expect(p).toHaveTextContent('Mobile fallback');
    const srSpan = container.querySelector('.sr-only');
    expect(srSpan).toBeNull();
  });

  it('includes a hidden placeholder span for CLS=0 when animated', () => {
    mockMatchMedia({
      '(prefers-reduced-motion: reduce)': false,
      '(max-width: 767px)': false,
    });

    const { container } = render(<AnimatedText text="CLS test" />);
    // The sr-only span has the text for screen readers
    const srSpan = container.querySelector('.sr-only');
    expect(srSpan).toBeInTheDocument();
    expect(srSpan).toHaveTextContent('CLS test');

    // The invisible placeholder with visibility: hidden
    const hiddenPlaceholder = container.querySelector('[style*="visibility: hidden"]');
    expect(hiddenPlaceholder).toBeInTheDocument();
    expect(hiddenPlaceholder).toHaveTextContent('CLS test');

    // The absolute animated wrapper
    const absoluteWrapper = container.querySelector('[style*="position: absolute"]');
    expect(absoluteWrapper).toBeInTheDocument();
  });

  it('renders text with spaces preserved in sr-only', () => {
    const { container } = render(<AnimatedText text="A B C" />);
    const srSpan = container.querySelector('.sr-only');
    expect(srSpan).toHaveTextContent('A B C');
  });

  it('accepts h1 as the as prop', () => {
    const { container } = render(<AnimatedText text="Hero title" as="h1" />);
    const h1 = container.querySelector('h1');
    expect(h1).toBeInTheDocument();
  });

  it('accepts h3 as the as prop', () => {
    const { container } = render(<AnimatedText text="Subtitle" as="h3" />);
    const h3 = container.querySelector('h3');
    expect(h3).toBeInTheDocument();
  });

  it('handles single-character text without error', () => {
    const { container } = render(<AnimatedText text="X" />);
    const p = container.querySelector('p');
    expect(p).toBeInTheDocument();
    const srSpan = container.querySelector('.sr-only');
    expect(srSpan).toHaveTextContent('X');
  });

  it('handles empty string text gracefully', () => {
    const { container } = render(<AnimatedText text="" />);
    const p = container.querySelector('p');
    expect(p).toBeInTheDocument();
    const srSpan = container.querySelector('.sr-only');
    expect(srSpan).toHaveTextContent('');
  });

  it('renders text with special characters correctly', () => {
    const { container } = render(<AnimatedText text="100% free!" />);
    const srSpan = container.querySelector('.sr-only');
    expect(srSpan).toHaveTextContent('100% free!');
  });

  it('does not animate when reduced motion is active even with className', () => {
    mockMatchMedia({
      '(prefers-reduced-motion: reduce)': true,
      '(max-width: 767px)': false,
    });

    const { container } = render(
      <AnimatedText text="Static" className="text-red-500" />,
    );
    const p = container.querySelector('p');
    expect(p).toHaveClass('text-red-500');
    expect(p?.textContent).toBe('Static');
    const srSpan = container.querySelector('.sr-only');
    expect(srSpan).toBeNull();
  });
});
