import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuroraBackground } from './aurora-background';

describe('AuroraBackground', () => {
  it('renders children inside the background', () => {
    render(
      <AuroraBackground>
        <div data-testid="hero-content">Hero Content</div>
      </AuroraBackground>,
    );
    expect(screen.getByTestId('hero-content')).toBeInTheDocument();
    expect(screen.getByTestId('hero-content')).toHaveTextContent('Hero Content');
  });

  it('renders an atmospheric glow overlay', () => {
    const { container } = render(
      <AuroraBackground>
        <div>Content</div>
      </AuroraBackground>,
    );
    // The atmospheric glow overlay should be a div with pointer-events-none
    const overlays = container.querySelectorAll('.pointer-events-none');
    // Should have at least one overlay (the atmospheric glow)
    expect(overlays.length).toBeGreaterThan(0);
  });

  it('has relative overflow-hidden root container', () => {
    const { container } = render(
      <AuroraBackground>
        <div>Content</div>
      </AuroraBackground>,
    );
    // The root motion.div has relative overflow-hidden classes
    const rootEl = container.firstElementChild;
    expect(rootEl).not.toBeNull();
    expect(rootEl!.className).toContain('relative');
    expect(rootEl!.className).toContain('overflow-hidden');
  });
});
