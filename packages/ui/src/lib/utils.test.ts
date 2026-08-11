import { describe, it, expect } from 'vitest';

import { cn } from './utils';

/**
 * cn() is the single class-merging helper every component in @core/ui goes
 * through, so a regression here is invisible until a variant silently stops
 * overriding its base classes.
 */
describe('cn', () => {
  it('joins several class strings', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  // The whole reason for tailwind-merge over plain clsx: the later utility has
  // to win, otherwise a variant cannot override the base class it is given.
  it('lets the last conflicting utility win', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('keeps utilities that do not conflict', () => {
    expect(cn('px-2', 'text-sm')).toBe('px-2 text-sm');
  });

  // Falsy branches are exercised with the values callers actually pass — an
  // absent prop is undefined or null, never a literal false written by hand.
  it('drops absent values instead of rendering them', () => {
    expect(cn('px-2', undefined, null, '')).toBe('px-2');
  });

  it('applies a conditional class only when its condition holds', () => {
    const active: string | undefined = 'ring-2';
    const inactive: string | undefined = undefined;
    expect(cn('px-2', active, inactive)).toBe('px-2 ring-2');
  });

  it('accepts arrays and objects the way clsx does', () => {
    expect(cn(['px-2', 'py-1'], { 'text-sm': true, 'text-lg': false })).toBe(
      'px-2 py-1 text-sm'
    );
  });

  it('returns an empty string when given nothing', () => {
    expect(cn()).toBe('');
  });
});
