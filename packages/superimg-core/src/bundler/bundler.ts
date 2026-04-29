//! Server-side template bundling with esbuild (Node/Bun/Deno)

import * as esbuild from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createSuperimgPlugin } from "./plugin.js";
import type {
  TemplateBundle as BundledTemplate,
  TemplateSourceMap as RawSourceMap,
} from "@superimg/types";

export type { BundledTemplate, RawSourceMap };

// Find the stdlib package location for resolution
// This file is at packages/superimg-core/dist/bundler.js
// The stdlib is at packages/superimg-stdlib (symlinked in node_modules)
const __dirname = dirname(fileURLToPath(import.meta.url));
// Go from dist/ to packages/superimg-core/node_modules
const stdlibNodePath = resolve(__dirname, "../node_modules");
const templateImportAliases = {
  "superimg/stdlib": "@superimg/stdlib",
};

/**
 * Extract a parsed sourcemap from the trailing `//# sourceMappingURL=data:...` comment.
 * Returns null when the bundle has no inline map (we always emit one, but defensive).
 */
export function extractInlineSourceMap(code: string): RawSourceMap | null {
  const match = code.match(
    /\/\/# sourceMappingURL=data:application\/json(?:;charset=utf-?8)?;base64,([A-Za-z0-9+/=]+)\s*$/,
  );
  if (!match) return null;
  try {
    const json = globalThis.atob
      ? globalThis.atob(match[1]!)
      : Buffer.from(match[1]!, "base64").toString("utf-8");
    return JSON.parse(json) as RawSourceMap;
  } catch {
    return null;
  }
}

/**
 * Bundle a template file, resolving all imports. Server-side only (Node/Bun/Deno).
 *
 * Returns the bundled code as a string. For runtime error enrichment with
 * mapped source locations, prefer {@link bundleTemplateWithMap}, which returns
 * `{ code, sourceMap, sourceFile }`.
 */
export async function bundleTemplate(entryPoint: string): Promise<string> {
  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    format: "iife",
    globalName: "__template",
    platform: "node",
    target: "es2020",
    sourcemap: "inline",
    alias: templateImportAliases,
    nodePaths: stdlibNodePath ? [stdlibNodePath] : [],
    plugins: [createSuperimgPlugin()],
  });
  return result.outputFiles[0]!.text;
}

/**
 * Bundle a template file and return the code, parsed sourcemap, and source path.
 * Use this when callers need to enrich runtime errors with mapped source locations.
 */
export async function bundleTemplateWithMap(
  entryPoint: string,
): Promise<BundledTemplate> {
  const code = await bundleTemplate(entryPoint);
  const sourceMap = extractInlineSourceMap(code);
  if (!sourceMap) {
    throw new Error(
      `bundleTemplateWithMap: esbuild did not emit an inline sourcemap for ${entryPoint}`,
    );
  }
  return { code, sourceMap, sourceFile: resolve(entryPoint) };
}

/** Bundle a template file as ESM for browser dynamic import. Server-side only. */
export async function bundleTemplateESM(entryPoint: string): Promise<string> {
  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    target: "es2020",
    sourcemap: "inline",
    alias: templateImportAliases,
    nodePaths: stdlibNodePath ? [stdlibNodePath] : [],
    plugins: [createSuperimgPlugin()],
  });
  return result.outputFiles[0]!.text;
}

/** Bundle a template file as ESM and return code + parsed sourcemap + source path. */
export async function bundleTemplateESMWithMap(
  entryPoint: string,
): Promise<BundledTemplate> {
  const code = await bundleTemplateESM(entryPoint);
  const sourceMap = extractInlineSourceMap(code);
  if (!sourceMap) {
    throw new Error(
      `bundleTemplateESMWithMap: esbuild did not emit an inline sourcemap for ${entryPoint}`,
    );
  }
  return { code, sourceMap, sourceFile: resolve(entryPoint) };
}

/** Options for bundling a string of template code. */
export interface BundleTemplateCodeOptions {
  /** Directory used to resolve relative imports inside the template code. */
  resolveDir?: string;
  /**
   * Logical filename for the source code. Used by esbuild to label the
   * source in the sourcemap (instead of the default `<stdin>`). Strongly
   * recommended when the caller has a real path on disk for the code.
   */
  sourcefile?: string;
}

/**
 * Bundle template code from a string. Server-side only.
 *
 * Prefer {@link bundleTemplateCodeWithMap} when callers need sourcemap-aware
 * error enrichment (returns `{ code, sourceMap, sourceFile }`).
 */
export async function bundleTemplateCode(
  code: string,
  resolveDirOrOptions?: string | BundleTemplateCodeOptions,
): Promise<string> {
  const opts: BundleTemplateCodeOptions =
    typeof resolveDirOrOptions === "string"
      ? { resolveDir: resolveDirOrOptions }
      : (resolveDirOrOptions ?? {});

  const result = await esbuild.build({
    stdin: {
      contents: code,
      loader: "ts",
      resolveDir:
        opts.resolveDir ??
        (globalThis.process?.cwd?.() ??
          (globalThis as any).Deno?.cwd?.() ??
          "/"),
      sourcefile: opts.sourcefile,
    },
    bundle: true,
    write: false,
    format: "iife",
    globalName: "__template",
    platform: "node",
    target: "es2020",
    sourcemap: "inline",
    alias: templateImportAliases,
    nodePaths: stdlibNodePath ? [stdlibNodePath] : [],
    plugins: [createSuperimgPlugin()],
  });
  return result.outputFiles[0]!.text;
}

/** Bundle template code from a string and return code + parsed sourcemap + source path. */
export async function bundleTemplateCodeWithMap(
  code: string,
  options: BundleTemplateCodeOptions = {},
): Promise<BundledTemplate> {
  const bundled = await bundleTemplateCode(code, options);
  const sourceMap = extractInlineSourceMap(bundled);
  if (!sourceMap) {
    throw new Error(
      `bundleTemplateCodeWithMap: esbuild did not emit an inline sourcemap`,
    );
  }
  return {
    code: bundled,
    sourceMap,
    sourceFile: options.sourcefile ?? "<stdin>",
  };
}
