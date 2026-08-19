import { describe, it, expect } from 'vitest';

import { depthOf, sortByHierarchy } from './module-hierarchy';

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

  /**
   * Nesting went to two levels so the agent's seven settings sections sit under
   * one heading instead of beside Chat and Carruseles.
   */
  it('places a grandchild under its parent, under its grandparent', () => {
    const input = [
      mod('ig-agent-topics', 'ig-agent-settings'),
      mod('ig-ai-agent'),
      mod('ig-ai-chat', 'ig-ai-agent'),
      mod('ig-agent-settings', 'ig-ai-agent'),
      mod('ig-agent-model', 'ig-agent-settings'),
    ];

    expect(sortByHierarchy(input).map((m) => m.id)).toEqual([
      'ig-ai-agent',
      'ig-ai-chat',
      'ig-agent-settings',
      'ig-agent-topics',
      'ig-agent-model',
    ]);
  });

  // The API should never produce a cycle, which is why one that quietly hung
  // the screen would be hard to trace back to this function.
  it('terminates on a cycle instead of recursing forever', () => {
    const input = [mod('a', 'b'), mod('b', 'a')];

    expect(sortByHierarchy(input).map((m) => m.id).sort()).toEqual(['a', 'b']);
  });

  describe('depthOf', () => {
    const tree = [
      mod('agent'),
      mod('settings', 'agent'),
      mod('topics', 'settings'),
    ];

    it('counts levels up to the root', () => {
      expect(tree.map((m) => depthOf(m, tree))).toEqual([0, 1, 2]);
    });

    /**
     * The transfer component splits one tree across two columns, so a module is
     * routinely rendered in a list its parent is missing from. Stopping is
     * better than inventing a level it does not have.
     */
    it('stops when the parent is not in the list', () => {
      const orphan = mod('topics', 'settings');

      expect(depthOf(orphan, [orphan])).toBe(0);
    });

    it('terminates on a cycle', () => {
      const a = mod('a', 'b');
      const cyclic = [a, mod('b', 'a')];

      expect(depthOf(a, cyclic)).toBeLessThan(3);
    });
  });
});
