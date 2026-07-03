//! Opt-in debug tracing for scene-template rolldown bundles.
//!
//! Enable: `SUPERIMG_BUNDLER_DEBUG=1` (any gumbo media render / superimg-cli render).

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);

export type BundlerDebugKind =
  | "entry-file"
  | "stdin-entry"
  | "bundleTemplate"
  | "bundleTemplateWithMap"
  | "bundleTemplateCode"
  | "bundleTemplateCodeWithMap";

export interface BundlerDebugContext {
  kind: BundlerDebugKind;
  entry: string;
  resolveDir?: string;
  sourcefile?: string;
}

export function bundlerDebugEnabled(): boolean {
  return (
    typeof process !== "undefined" &&
    process.env.SUPERIMG_BUNDLER_DEBUG === "1"
  );
}

function tryReadEntrySnippet(entry: string, resolveDir?: string): {
  resolvedPath: string;
  exists: boolean;
  bytes?: number;
  mediaImports: string[];
} {
  const resolvedPath = resolveDir ? resolve(resolveDir, entry) : resolve(entry);
  try {
    const content = readFileSync(resolvedPath, "utf8");
    const mediaImports = content
      .split("\n")
      .map((line) => line.trim())
      .filter(
        (line) =>
          line.startsWith("import ") &&
          (line.includes("gumbo/media/define") ||
            line.includes("gumbo/media") ||
            line.includes("superimg") ||
            line.includes("@superimg/")),
      );
    return {
      resolvedPath,
      exists: true,
      bytes: content.length,
      mediaImports,
    };
  } catch {
    return { resolvedPath, exists: false, mediaImports: [] };
  }
}

export function logBundlerDebug(
  stage: string,
  ctx: BundlerDebugContext,
  detail: Record<string, unknown> = {},
): void {
  if (!bundlerDebugEnabled()) return;
  const prefix = `[superimg-bundler-debug][${ctx.kind}]`;
  const payload = {
    stage,
    entry: ctx.entry,
    resolveDir: ctx.resolveDir,
    sourcefile: ctx.sourcefile,
    rolldownVersion: tryRolldownVersion(),
    pid: process.pid,
    ...detail,
  };
  console.error(`${prefix} ${stage}`, JSON.stringify(payload, null, 2));
}

export function logBundlerEntry(ctx: BundlerDebugContext): void {
  if (!bundlerDebugEnabled()) return;
  const snippet = tryReadEntrySnippet(ctx.entry, ctx.resolveDir);
  logBundlerDebug("entry", ctx, { snippet });
}

function tryRolldownVersion(): string | undefined {
  try {
    const pkg = require("rolldown/package.json") as { version?: string };
    return pkg.version;
  } catch {
    return undefined;
  }
}

export const TEMPLATE_IIFE_OUTPUT = {
  format: "iife" as const,
  name: "__template",
  exports: "named" as const,
  codeSplitting: false,
};