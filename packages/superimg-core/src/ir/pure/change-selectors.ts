//! Stable identity matching for `diff --expect-only`.

export type SelectorKind =
  | "motion"
  | "node"
  | "scene"
  | "track"
  | "step"
  | "frame"
  | "kind"
  | "role"
  | "tag"
  | "bare";

export interface ParsedSelector {
  kind: SelectorKind;
  value: string;
}

/** Parse one selector token: `motion:id`, `node:id`, `step:id`, bare id, etc. */
export function parseSelector(raw: string): ParsedSelector {
  const s = raw.trim();
  const m = s.match(/^(motion|node|id|scene|track|step|frame|kind|role|tag):(.+)$/i);
  if (m) {
    let kind = m[1]!.toLowerCase() as SelectorKind | "id";
    if (kind === "id") kind = "node";
    return { kind: kind as SelectorKind, value: m[2]!.trim() };
  }
  return { kind: "bare", value: s };
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}

export function matchId(pattern: string, id: string): boolean {
  const local = id.includes("::") ? id.slice(id.lastIndexOf("::") + 2) : id;
  if (pattern.includes("*") || pattern.includes("?")) {
    const re = globToRegExp(pattern);
    return re.test(id) || re.test(local);
  }
  return pattern === id || pattern === local || id.endsWith(`::${pattern}`);
}

/**
 * Classify diff identity IDs against expect-only patterns.
 * Diff ids look like `motion/default::title.enter`, `node/...`, `scene/...`.
 */
export function classifyExpectedChanges(
  changedIds: string[],
  expectPatterns: string[],
): {
  matched: string[];
  unexpected: string[];
  missing: string[];
} {
  const matched: string[] = [];
  const unexpected: string[] = [];
  const hitPatterns = new Set<string>();

  for (const id of changedIds) {
    let ok = false;
    for (const pat of expectPatterns) {
      if (matchesExpectPattern(pat, id)) {
        ok = true;
        hitPatterns.add(pat);
      }
    }
    if (ok) matched.push(id);
    else unexpected.push(id);
  }

  const missing = expectPatterns.filter((p) => !hitPatterns.has(p));
  return { matched, unexpected, missing };
}

function matchesExpectPattern(pattern: string, changeId: string): boolean {
  // pattern may be "motion:x", "intro::title.enter", "motion/default::x"
  const p = pattern.trim();
  if (matchId(p, changeId)) return true;
  // strip category prefix from changeId
  const slash = changeId.indexOf("/");
  const bare = slash >= 0 ? changeId.slice(slash + 1) : changeId;
  if (matchId(p, bare)) return true;
  const parsed = parseSelector(p);
  if (parsed.kind !== "bare") {
    const cat = parsed.kind === "node" ? "node" : parsed.kind;
    if (changeId.startsWith(`${cat}/`)) {
      return matchId(parsed.value, bare);
    }
    // motion:foo also matches if bare is foo
    return matchId(parsed.value, bare);
  }
  return matchId(p, bare) || changeId.includes(p);
}
