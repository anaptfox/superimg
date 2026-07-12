//! Semantic set-diff for inspect samples.

export interface InspectDiff {
  from: number;
  to: number;
  addedText: string[];
  removedText: string[];
  addedColors: string[];
  removedColors: string[];
  addedEqKeys: string[];
  removedEqKeys: string[];
}

function setDiff(a: string[], b: string[]): { added: string[]; removed: string[] } {
  const aSet = new Set(a);
  const bSet = new Set(b);
  const added = b.filter((x) => !aSet.has(x));
  const removed = a.filter((x) => !bSet.has(x));
  // unique preserve order
  return {
    added: [...new Set(added)],
    removed: [...new Set(removed)],
  };
}

export function diffSemantics(
  from: number,
  to: number,
  a: { text: string[]; colors: string[]; eqKeys: string[] },
  b: { text: string[]; colors: string[]; eqKeys: string[] },
): InspectDiff {
  const text = setDiff(a.text, b.text);
  const colors = setDiff(a.colors, b.colors);
  const eqKeys = setDiff(a.eqKeys, b.eqKeys);
  return {
    from,
    to,
    addedText: text.added,
    removedText: text.removed,
    addedColors: colors.added,
    removedColors: colors.removed,
    addedEqKeys: eqKeys.added,
    removedEqKeys: eqKeys.removed,
  };
}
