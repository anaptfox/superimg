import { filmScript, parseScript } from "@foxworth/superimg-script";
import type { TakeCueDiff, TakeCueSnapshot, TakeDiff, TakeFileDiff, TakeLike } from "./types.js";

const round = (n: number) => Math.round(n * 1e6) / 1e6;

function cuesFromScriptMarkdown(markdown: string): TakeCueSnapshot[] {
  const doc = parseScript(markdown);
  if (!doc) return [];
  const film = filmScript(doc);
  const out: TakeCueSnapshot[] = [];
  for (const block of film.blocks) {
    if (!block.id) continue;
    if (block.kind === "shot") {
      out.push({
        id: block.id,
        kind: "shot",
        ...(block.hold !== undefined ? { hold: block.hold } : {}),
        ...(block.still !== undefined ? { still: block.still } : {}),
        ...(block.text ? { text: block.text } : {}),
      });
    } else if (block.kind === "speech") {
      out.push({
        id: block.id,
        kind: "speech",
        who: block.who,
        text: block.lines.join("\n"),
        ...(block.at?.start !== undefined ? { start: block.at.start } : {}),
        ...(block.at?.end !== undefined ? { end: block.at.end } : {}),
      });
    } else {
      out.push({
        id: block.id,
        kind: "card",
        text: block.lines.join("\n"),
        ...(block.at?.start !== undefined ? { start: block.at.start } : {}),
        ...(block.at?.end !== undefined ? { end: block.at.end } : {}),
      });
    }
  }
  return out;
}

function cueDuration(cue: TakeCueSnapshot): number | undefined {
  if (cue.hold !== undefined) return cue.hold;
  if (cue.start !== undefined && cue.end !== undefined) return round(cue.end - cue.start);
  return undefined;
}

function cuesDiffer(a: TakeCueSnapshot, b: TakeCueSnapshot): {
  changed: boolean;
  deltaSeconds?: number;
  textChanged: boolean;
} {
  const durA = cueDuration(a);
  const durB = cueDuration(b);
  const deltaSeconds =
    durA !== undefined && durB !== undefined && Math.abs(durB - durA) > 1e-6
      ? round(durB - durA)
      : undefined;
  const textChanged = (a.text ?? "") !== (b.text ?? "") || (a.who ?? "") !== (b.who ?? "");
  const timingChanged =
    deltaSeconds !== undefined ||
    a.start !== b.start ||
    a.end !== b.end ||
    a.still !== b.still ||
    a.hold !== b.hold;
  const changed = textChanged || timingChanged || a.kind !== b.kind;
  return {
    changed,
    ...(deltaSeconds !== undefined ? { deltaSeconds } : {}),
    textChanged,
  };
}

export interface DiffTakesOptions {
  /** Optional raw `.script.md` source from the first take when cues were not snapshotted. */
  readonly fromScript?: string;
  /** Optional raw `.script.md` source from the second take when cues were not snapshotted. */
  readonly toScript?: string;
}

/**
 * Compare two takes across files, duration, hashes, and per-cue timing/text changes.
 * Accepts CLI v1 `TakeRecord` and portable `TakeRecordV2` values alike.
 */
export function diffTakes(
  from: TakeLike,
  to: TakeLike,
  options: DiffTakesOptions = {},
): TakeDiff {
  const fromFiles = new Map((from.files ?? []).map((file) => [file.path, file.sha256]));
  const toFiles = new Map((to.files ?? []).map((file) => [file.path, file.sha256]));
  const allPaths = [...new Set([...fromFiles.keys(), ...toFiles.keys()])].sort();

  const files: TakeFileDiff[] = [];
  for (const path of allPaths) {
    const beforeSha256 = fromFiles.get(path);
    const afterSha256 = toFiles.get(path);
    if (beforeSha256 === undefined && afterSha256 !== undefined) {
      files.push({ path, change: "added", afterSha256 });
    } else if (beforeSha256 !== undefined && afterSha256 === undefined) {
      files.push({ path, change: "removed", beforeSha256 });
    } else if (beforeSha256 !== undefined && afterSha256 !== undefined && beforeSha256 !== afterSha256) {
      files.push({ path, change: "changed", beforeSha256, afterSha256 });
    }
  }

  const fromCuesList = from.cues ?? (options.fromScript ? cuesFromScriptMarkdown(options.fromScript) : []);
  const toCuesList = to.cues ?? (options.toScript ? cuesFromScriptMarkdown(options.toScript) : []);
  const fromCues = new Map(fromCuesList.map((cue) => [cue.id, cue]));
  const toCues = new Map(toCuesList.map((cue) => [cue.id, cue]));
  const orderedCueIds = [...new Set([...fromCues.keys(), ...toCues.keys()])];

  const cues: TakeCueDiff[] = [];
  for (const id of orderedCueIds) {
    const before = fromCues.get(id);
    const after = toCues.get(id);
    if (!before && after) {
      cues.push({ id, ...(after.kind ? { kind: after.kind } : {}), change: "added", after });
    } else if (before && !after) {
      cues.push({ id, ...(before.kind ? { kind: before.kind } : {}), change: "removed", before });
    } else if (before && after) {
      const cmp = cuesDiffer(before, after);
      if (cmp.changed) {
        cues.push({
          id,
          ...(after.kind ?? before.kind ? { kind: after.kind ?? before.kind } : {}),
          change: "changed",
          before,
          after,
          ...(cmp.deltaSeconds !== undefined ? { deltaSeconds: cmp.deltaSeconds } : {}),
          ...(cmp.textChanged ? { textChanged: true } : {}),
        });
      }
    }
  }

  const durationDeltaSeconds =
    from.duration !== undefined && to.duration !== undefined
      ? round(to.duration - from.duration)
      : null;

  const programChanged =
    from.programHash !== undefined && to.programHash !== undefined
      ? from.programHash !== to.programHash
      : files.length > 0;

  const scriptChanged =
    from.scriptHash !== undefined && to.scriptHash !== undefined
      ? from.scriptHash !== to.scriptHash
      : cues.length > 0 || files.some((file) => file.path.toLowerCase().endsWith(".script.md"));

  return {
    fromId: from.id,
    toId: to.id,
    durationDeltaSeconds,
    programChanged,
    scriptChanged,
    files,
    cues,
  };
}

/** Concise human-readable summary of a `TakeDiff` for CLI output. */
export function formatTakeDiff(diff: TakeDiff): string {
  const lines: string[] = [`diff ${diff.fromId} -> ${diff.toId}`];
  if (diff.durationDeltaSeconds !== null) {
    const sign = diff.durationDeltaSeconds > 0 ? "+" : "";
    lines.push(`  duration: ${sign}${diff.durationDeltaSeconds}s`);
  }
  if (diff.cues.length > 0) {
    lines.push("  cues:");
    for (const cue of diff.cues) {
      const kind = cue.kind ? ` [${cue.kind}]` : "";
      if (cue.change === "added") {
        lines.push(`    + ${cue.id}${kind}`);
      } else if (cue.change === "removed") {
        lines.push(`    - ${cue.id}${kind}`);
      } else {
        const details: string[] = [];
        if (cue.deltaSeconds !== undefined) {
          const sign = cue.deltaSeconds > 0 ? "+" : "";
          details.push(`${sign}${cue.deltaSeconds}s`);
        }
        if (cue.textChanged) details.push("text");
        lines.push(`    ~ ${cue.id}${kind}${details.length ? ` (${details.join(", ")})` : ""}`);
      }
    }
  }
  if (diff.files.length > 0) {
    lines.push("  files:");
    for (const file of diff.files) {
      const prefix = file.change === "added" ? "+" : file.change === "removed" ? "-" : "~";
      lines.push(`    ${prefix} ${file.path}`);
    }
  }
  if (diff.cues.length === 0 && diff.files.length === 0 && (diff.durationDeltaSeconds === null || diff.durationDeltaSeconds === 0)) {
    lines.push("  (no differences)");
  }
  return lines.join("\n");
}
