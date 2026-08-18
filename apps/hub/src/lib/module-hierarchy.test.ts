import { describe, it, expect } from 'vitest';

import { sortByHierarchy } from './module-hierarchy';

const mod = (id: string, parentId: string | null = null) => ({ id, parentId });

describe('sortByHierarchy', () => {
  /**
   * The case that broke it. The API sorts by id, and `ig-ag` sorts before
   * `ig-ai`, so every settings section landed above the parent it belongs to.
   * The older children only looked nested by luck: `ig-ai-chat` happens to sort
   * after `ig-ai-agent`.
   */
  it('pulls children that sort before their parent back under it', () => {
    const byId = [
      mod('ig-agent-model', 'ig-ai-agent'),
      mod('ig-agent-topics', 'ig-ai-agent'),
      mod('ig-ai-agent'),
      mod('ig-ai-chat', 'ig-ai-agent'),
      mod('ig-basic-metrics'),
    ];

    expect(sortByHierarchy(byId).map((m) => m.id)).toEqual([
      'ig-ai-agent',
      'ig-agent-model',
      'ig-agent-topics',
      'ig-ai-chat',
      'ig-basic-metrics',
    ]);
  });

  it('keeps the incoming order among parents', () => {
    const input = [mod('z-parent'), mod('a-parent')];

    expect(sortByHierarchy(input).map((m) => m.id)).toEqual(['z-parent', 'a-parent']);
  });

  it('keeps the incoming order among siblings', () => {
    const input = [mod('p'), mod('z-child', 'p'), mod('a-child', 'p')];

    expect(sortByHierarchy(input).map((m) => m.id)).toEqual(['p', 'z-child', 'a-child']);
  });

  /**
   * A child reached only through its parent would disappear from the screen
   * when the parent is filtered out — worse than showing it out of place.
   */
  it('still shows a child whose parent is not in the list', () => {
    const input = [mod('lonely', 'missing-parent'), mod('root')];

    expect(sortByHierarchy(input).map((m) => m.id)).toEqual(['root', 'lonely']);
  });

  it('handles a flat list and an empty one', () => {
    expect(sortByHierarchy([mod('a'), mod('b')]).map((m) => m.id)).toEqual(['a', 'b']);
    expect(sortByHierarchy([])).toEqual([]);
  });

  it('does not mutate the input', () => {
    const input = [mod('child', 'parent'), mod('parent')];
    const before = input.map((m) => m.id);

    sortByHierarchy(input);

    expect(input.map((m) => m.id)).toEqual(before);
  });
});
