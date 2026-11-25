//! superimg baseline save|show|clear — project-local Media IR snapshots for expect-only diff

import { join, basename, dirname } from "node:path";
import { createBaselineStore, type BaselineMeta } from "@foxworth/superimg-node/baseline";
export type { BaselineMeta } from "@foxworth/superimg-node/baseline";
import { normalizeSourceId } from "@superimg/core";
import { formatError } from "@superimg/core/errors";
import { findProjectRoot } from "../utils/find-project-root.js";
import { resolveTemplatePath } from "../utils/resolve-template.js";
import { evaluateTemplateIR } from "../utils/ir-eval.js";

const BASELINE_DIR = ".superimg-baseline";

function baselineRoot(projectRoot?: string): string {
  return join(projectRoot ?? findProjectRoot(), ".superimg-baseline");
}

export async function baselineSaveCommand(
  templateArg: string,
  options: { data?: string; pretty?: boolean } = {},
): Promise<number> {
  try {
    const resolved = resolveTemplatePath(templateArg);
    const sourceId = normalizeSourceId(basename(resolved));

    let data: Record<string, unknown> | undefined;
    if (options.data) {
      const { loadDataInput } = await import("../utils/data-loader.js");
      const loaded = await loadDataInput(options.data, dirname(resolved));
      if (loaded && typeof loaded === "object" && !Array.isArray(loaded)) {
        data = loaded as Record<string, unknown>;
      }
    }

    const evalResult = await evaluateTemplateIR(resolved, {
      ...(data !== undefined ? { data } : {}),
      sourceId: sourceId,
    });
    if (evalResult.mode !== "ir" || !evalResult.ir) {
      throw new Error(
        `Cannot baseline runtime-fallback template (${evalResult.fallbackReason ?? "no IR"}). ` +
          `Use inspect --diff for mode:"animation" templates.`,
      );
    }

    const { path: dir, meta } = await createBaselineStore(baselineRoot()).save({
      sourceId, sourcePath: resolved, media: evalResult.ir,
    });

    const report = {
      schemaVersion: 0,
      ok: true,
      path: dir,
      meta,
    };
    process.stdout.write(
      (options.pretty ? JSON.stringify(report, null, 2) : JSON.stringify(report)) +
        "\n",
    );
    return 0;
  } catch (err) {
    const formatted = formatError(err);
    process.stdout.write(
      JSON.stringify({ schemaVersion: 0, ok: false, error: formatted.json }) + "\n",
    );
    return 1;
  }
}

export async function baselineShowCommand(
  templateArg?: string,
  options: { pretty?: boolean } = {},
): Promise<number> {
  try {
    const id = templateArg ? normalizeSourceId(basename(resolveTemplatePath(templateArg))) : undefined;
    const baselines = (await createBaselineStore(baselineRoot()).list()).filter(meta => id === undefined || meta.sourceId === id);
    process.stdout.write(
      (options.pretty
        ? JSON.stringify({ schemaVersion: 0, ok: true, baselines }, null, 2)
        : JSON.stringify({ schemaVersion: 0, ok: true, baselines })) + "\n",
    );
    return 0;
  } catch (err) {
    const formatted = formatError(err);
    process.stdout.write(
      JSON.stringify({ schemaVersion: 0, ok: false, error: formatted.json }) + "\n",
    );
    return 1;
  }
}

export async function baselineClearCommand(
  templateArg?: string,
  options: { all?: boolean } = {},
): Promise<number> {
  try {
    const store = createBaselineStore(baselineRoot());
    if (options.all || !templateArg) {
      await store.clearAll();
      process.stdout.write(JSON.stringify({ schemaVersion: 0, ok: true, cleared: "all" }) + "\n");
      return 0;
    }
    const id = normalizeSourceId(basename(resolveTemplatePath(templateArg)));
    await store.clear(id);
    process.stdout.write(
      JSON.stringify({ schemaVersion: 0, ok: true, cleared: id }) + "\n",
    );
    return 0;
  } catch (err) {
    const formatted = formatError(err);
    process.stdout.write(
      JSON.stringify({ schemaVersion: 0, ok: false, error: formatted.json }) + "\n",
    );
    return 1;
  }
}

export async function readBaseline(
  sourceId: string,
): Promise<{ media: import("@superimg/types").MediaIR; meta: BaselineMeta } | null> {
  return createBaselineStore(baselineRoot()).read(sourceId);
}
