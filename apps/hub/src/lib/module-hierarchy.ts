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
 * Nesting is one level, so this is one pass: keep the incoming order among
 * parents, and place each parent's children right after it.
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
  for (const mod of modules) {
    if (mod.parentId !== null) continue;
    ordered.push(mod, ...(childrenOf.get(mod.id) ?? []));
  }

  // A child whose parent is absent from this list — filtered out, or pointing at
  // something deleted — would vanish entirely if it were only ever reached
  // through its parent. Better shown at the end than silently dropped.
  const placed = new Set(ordered.map((mod) => mod.id));
  return [...ordered, ...modules.filter((mod) => !placed.has(mod.id))];
}
