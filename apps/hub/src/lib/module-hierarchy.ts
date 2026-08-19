/** The shape both module screens share; anything with these two fields works. */
interface HierarchicalModule {
  id: string;
  parentId: string | null;
}

/**
 * Orders a flat module list so each child sits directly under its parent.
 *
 * The API returns modules sorted by id, and the screens drew that order as-is.
 * It looked like a hierarchy only by luck: `ig-ai-chat` and its siblings happen
 * to sort after `ig-ai-agent`, so the indent lined up. `ig-agent-topics` and the
 * rest of the settings sections sort *before* it — `ig-ag` < `ig-ai` — so they
 * rendered above the parent they belong to, marked as children of something
 * further down the table.
 *
 * Walks depth-first, keeping the incoming order among siblings. Nesting is two
 * levels, but the walk does not count: a depth limit here would only turn a
 * data problem into a silently truncated list.
 */
export function sortByHierarchy<T extends HierarchicalModule>(modules: readonly T[]): T[] {
  const childrenOf = new Map<string, T[]>();
  for (const mod of modules) {
    if (mod.parentId === null) continue;
    const siblings = childrenOf.get(mod.parentId);
    if (siblings === undefined) childrenOf.set(mod.parentId, [mod]);
    else siblings.push(mod);
  }

  const ordered: T[] = [];
  const seen = new Set<string>();
  const visit = (mod: T) => {
    // A cycle would otherwise recurse forever. The API should never produce
    // one, which is exactly why a list that quietly hangs would be hard to
    // trace back here.
    if (seen.has(mod.id)) return;
    seen.add(mod.id);
    ordered.push(mod);
    for (const child of childrenOf.get(mod.id) ?? []) visit(child);
  };

  for (const mod of modules) {
    if (mod.parentId !== null) continue;
    visit(mod);
  }

  // A module whose parent is absent from this list — filtered out, deleted, or
  // part of a cycle — would vanish entirely if it were only ever reached
  // through its parent. Better shown at the end than silently dropped.
  return [...ordered, ...modules.filter((mod) => !seen.has(mod.id))];
}

/**
 * How deep a module sits: 0 top level, 1 child, 2 grandchild.
 *
 * Screens used to ask `parentId !== null` and indent by a fixed amount, which
 * drew a grandchild at the same offset as its own parent. Walks up rather than
 * trusting a depth column, so it stays right whatever the list was filtered to;
 * an unknown parent stops the walk instead of inventing a level.
 */
export function depthOf<T extends HierarchicalModule>(
  mod: T,
  modules: readonly T[],
): number {
  const byId = new Map(modules.map((m) => [m.id, m]));
  const seen = new Set<string>([mod.id]);
  let depth = 0;
  let current = mod;
  while (current.parentId !== null) {
    const parent = byId.get(current.parentId);
    if (parent === undefined || seen.has(parent.id)) break;
    seen.add(parent.id);
    current = parent;
    depth += 1;
  }
  return depth;
}
