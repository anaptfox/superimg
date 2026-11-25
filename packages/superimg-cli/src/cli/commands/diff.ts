//! superimg diff — compare two Media IR manifests / artifacts / baseline

import { basename, dirname, resolve } from "node:path";
import {
  diffMediaIR,
  normalizeSourceId,
  selectVerificationFrames,
} from "@superimg/core";
import type { MediaIRDiff, MediaIR } from "@superimg/types";
import { formatError } from "@superimg/core/errors";
import { loadIrFromPath } from "../utils/load-ir.js";
import { classifyExpectedChanges } from "../utils/ir-selector.js";
import { evaluateTemplateIR } from "../utils/ir-eval.js";
import { readBaseline } from "./baseline.js";
import { resolveTemplatePath } from "../utils/resolve-template.js";

import { shouldFailMediaDiff, type MediaDiffFailOn as FailOnKind } from "@superimg/core/ir";
export type { MediaDiffFailOn as FailOnKind } from "@superimg/core/ir";

export interface DiffCommandOptions {
  pretty?: boolean;
  json?: boolean;
  failOn?: FailOnKind | string;
  renderChanges?: boolean;
  /** Use saved baseline as "before" IR. */
  baseline?: boolean;
  /** Comma-separated expect-only change ids / globs. */
  expectOnly?: string;
  data?: string;
}

const FAIL_ON_VALUES: FailOnKind[] = [
  "any",
  "timing",
  "content",
  "motion",
  "assets",
  "opaque",
  "none",
];


async function loadSide(
  path: string,
  options: DiffCommandOptions,
): Promise<MediaIR> {
  // Template path → evaluate IR
  try {
    if (
      path.endsWith(".media.ts") ||
      path.endsWith(".media.js") ||
      path.endsWith(".ts") ||
      path.endsWith(".js")
    ) {
      const resolved = resolveTemplatePath(path);
      let data: Record<string, unknown> | undefined;
      if (options.data) {
        const { loadDataInput } = await import("../utils/data-loader.js");
        const loaded = await loadDataInput(options.data, dirname(resolved));
        if (loaded && typeof loaded === "object" && !Array.isArray(loaded)) {
          data = loaded as Record<string, unknown>;
        }
      }
      const ev = await evaluateTemplateIR(resolved, {
        ...(data !== undefined ? { data } : {}),
      });
      if (ev.mode === "ir" && ev.ir) return ev.ir;
      throw new Error(ev.fallbackReason ?? "Cannot IR-compile after side");
    }
  } catch (err) {
    // Fall through to loadIrFromPath
    if (String(err).includes("Cannot IR-compile")) throw err;
  }
  return loadIrFromPath(path);
}

export async function diffCommand(
  beforePath: string | undefined,
  afterPath: string | undefined,
  options: DiffCommandOptions = {},
): Promise<number> {
  try {
    const failOnRaw = options.failOn ?? "none";
    if (!FAIL_ON_VALUES.includes(failOnRaw as FailOnKind)) {
      throw new Error(
        `Invalid --fail-on "${failOnRaw}". Expected one of: ${FAIL_ON_VALUES.join(", ")}`,
      );
    }
    const failOn = failOnRaw as FailOnKind;

    let before: MediaIR;
    let after: MediaIR;
    let renderTarget: string | undefined;
    let baselineMeta: Awaited<ReturnType<typeof readBaseline>> extends infer R
      ? R extends { meta: infer M }
        ? M
        : null
      : null = null as never;
    let stale = false;

    if (options.baseline) {
      // beforePath is the template (or omitted afterPath)
      const templateArg = afterPath ?? beforePath;
      if (!templateArg) {
        throw new Error("diff --baseline requires a template path");
      }
      const resolved = resolveTemplatePath(templateArg);
      renderTarget = resolved;
      const sourceId = normalizeSourceId(basename(resolved));
      const bl = await readBaseline(sourceId);
      if (bl && resolve(bl.meta.sourcePath) !== resolve(resolved)) throw new Error(`BASELINE_COLLISION: ${sourceId} belongs to ${bl.meta.sourcePath}`);
      if (!bl) {
        throw new Error(
          `No baseline for ${sourceId}. Run: superimg baseline save ${templateArg}`,
        );
      }
      before = bl.media;
      baselineMeta = bl.meta;

      let data: Record<string, unknown> | undefined;
      if (options.data) {
        const { loadDataInput } = await import("../utils/data-loader.js");
        const loaded = await loadDataInput(options.data, dirname(resolved));
        if (loaded && typeof loaded === "object" && !Array.isArray(loaded)) {
          data = loaded as Record<string, unknown>;
        }
      }
      const ev = await evaluateTemplateIR(resolved, {
        ...(data !== undefined ? { data } : {}),
        sourceId: sourceId,
      });
      if (ev.mode !== "ir" || !ev.ir) {
        throw new Error(ev.fallbackReason ?? "Cannot IR-compile current template");
      }
      after = ev.ir;
      stale = bl.meta.programHash !== after.hashes.programHash;
    } else {
      if (!beforePath || !afterPath) {
        throw new Error("diff requires <before> <after> paths (or --baseline <template>)");
      }
      before = await loadSide(beforePath, options);
      after = await loadSide(afterPath, options);
      renderTarget = afterPath;
    }

    const diff = diffMediaIR(before, after);
    const verificationFrames = selectVerificationFrames(diff);
    let contactSheetPath: string | undefined;
    if (
      options.renderChanges &&
      renderTarget &&
      verificationFrames.length > 0
    ) {
      let data: Record<string, unknown> | undefined;
      if (options.data) {
        const { loadDataInput } = await import("../utils/data-loader.js");
        const loaded = await loadDataInput(options.data, dirname(resolveTemplatePath(renderTarget)));
        if (loaded && typeof loaded === "object" && !Array.isArray(loaded)) {
          data = loaded as Record<string, unknown>;
        }
      }
      const { renderDiffContactSheet } = await import(
        "../utils/render-diff-contact-sheet.js"
      );
      contactSheetPath = await renderDiffContactSheet({
        targetPath: renderTarget,
        frames: verificationFrames,
        media: after,
        ...(data ? { data } : {}),
      });
    }

    const changedIds = [
      ...diff.identity.added,
      ...diff.identity.removed,
      ...diff.identity.modified,
    ];

    let expectOnlyReport:
      | {
          requested: string[];
          matchedChanges: string[];
          unexpectedChanges: string[];
          missingExpectedChanges: string[];
        }
      | undefined;

    let exitExpect = 0;
    if (options.expectOnly) {
      const requested = options.expectOnly
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const { matched, unexpected, missing } = classifyExpectedChanges(
        changedIds,
        requested,
      );
      expectOnlyReport = {
        requested,
        matchedChanges: matched,
        unexpectedChanges: unexpected,
        missingExpectedChanges: missing,
      };
      // Exit 0 iff no unexpected AND no missing
      if (unexpected.length > 0 || missing.length > 0) exitExpect = 1;
    }

    const report = {
      schemaVersion: 0 as const,
      result: diff.result,
      sourceOnly: diff.sourceOnly,
      pixelVerificationRequired: diff.pixelVerificationRequired,
      changes: diff.changes,
      affectedFrames: diff.affectedFrames,
      identity: diff.identity,
      verificationFrames,
      ...(contactSheetPath ? { contactSheetPath } : {}),
      ...(baselineMeta
        ? {
            baseline: {
              sourceId: baselineMeta.sourceId,
              savedAt: baselineMeta.savedAt,
              stale,
            },
          }
        : {}),
      ...(expectOnlyReport !== undefined ? { expectOnly: expectOnlyReport } : {}),
    };

    const text = options.pretty
      ? JSON.stringify(report, null, 2)
      : JSON.stringify(report);
    process.stdout.write(text + "\n");

    if (options.expectOnly) return exitExpect;
    return shouldFailMediaDiff(diff, failOn) ? 1 : 0;
  } catch (err) {
    const formatted = formatError(err);
    const report = {
      schemaVersion: 0 as const,
      ok: false as const,
      error: formatted.json,
    };
    process.stdout.write(
      (options.pretty ? JSON.stringify(report, null, 2) : JSON.stringify(report)) + "\n",
    );
    return 1;
  }
}
