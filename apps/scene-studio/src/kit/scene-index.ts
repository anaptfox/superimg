import type { SceneNodeSnapshot, SceneSnapshot } from "@foxworth/superimg/interactive/define";

export interface SceneBranch {
  readonly node: SceneNodeSnapshot;
  readonly children: readonly SceneBranch[];
}

export interface SceneIndex {
  readonly snapshot: SceneSnapshot;
  readonly byId: ReadonlyMap<string, SceneNodeSnapshot>;
  readonly roots: readonly SceneBranch[];
}

/** One index and bounded tree projection for one accepted snapshot. */
export function indexScene(snapshot: SceneSnapshot): SceneIndex {
  const byId = new Map(snapshot.nodes.map(node => [node.id, node]));
  const roots: SceneBranch[] = [];
  type Pending = { id: string; into: SceneBranch[]; exit?: false } | { id: string; exit: true };
  const pending: Pending[] = snapshot.rootIds.toReversed().map(id => ({ id, into: roots }));
  const ancestors = new Set<string>();
  while (pending.length > 0) {
    const next = pending.pop()!;
    if (next.exit) {
      ancestors.delete(next.id);
      continue;
    }
    const node = byId.get(next.id);
    // Semantic relationships may contain cycles or detached references. The
    // inspector renders finite paths without changing the library's validation.
    if (!node || ancestors.has(node.id)) continue;
    const children: SceneBranch[] = [];
    next.into.push({ node, children });
    ancestors.add(node.id);
    pending.push({ id: node.id, exit: true });
    for (let i = node.childIds.length - 1; i >= 0; i--) {
      pending.push({ id: node.childIds[i]!, into: children });
    }
  }
  return { snapshot, byId, roots };
}

export function sceneMatches(index: SceneIndex | null, role: string | null): readonly SceneNodeSnapshot[] {
  if (!index || role === null) return [];
  return index.snapshot.nodes.filter(node => node.role === role);
}

/** Reusing the accumulated closure avoids revisiting shared ancestor chains. */
export function visibleSceneIds(
  index: SceneIndex,
  matches: readonly SceneNodeSnapshot[],
): ReadonlySet<string> {
  const visible = new Set<string>();
  for (const match of matches) {
    let id: string | null = match.id;
    while (id !== null && !visible.has(id)) {
      const node = index.byId.get(id);
      if (!node) break;
      visible.add(id);
      id = node.parentId;
    }
  }
  return visible;
}
