import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ParticlesCanvas } from './ParticlesCanvas';

describe('ParticlesCanvas', () => {
  it('renders a canvas element with aria-hidden', () => {
    const { container } = render(<ParticlesCanvas />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas!.tagName).toBe('CANVAS');
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders canvas with pointer-events-none class', () => {
    const { container } = render(<ParticlesCanvas />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas!.className).toContain('pointer-events-none');
  });

  it('renders as full-size canvas covering container', () => {
    const { container } = render(<ParticlesCanvas />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas!.className).toContain('absolute');
    expect(canvas!.className).toContain('inset-0');
    expect(canvas!.className).toContain('h-full');
    expect(canvas!.className).toContain('w-full');
  });

  it('handles 2D context gracefully when not available', () => {
    // jsdom stubs getContext to throw — the component guards with `if (!ctx) return;`
    const { container } = render(<ParticlesCanvas />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    // Component renders without throwing despite getContext failure
  });
});
