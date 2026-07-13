//! Server-side template bundling with Rolldown (Node/Bun/Deno)

import { rolldown } from "rolldown";
import { resolve } from "node:path";
import { createSuperimgPlugin, resolveDefinePath } from "./plugin.js";
import {
  logBundlerDebug,
  logBundlerEntry,
  TEMPLATE_IIFE_OUTPUT,
  type BundlerDebugContext,
} from "./bundler-debug.js";
import { templateBundlerInputOptions } from "./rolldown-log.js";
import { toTemplateSourceMap } from "./source-map.js";
import type {
  TemplateBundle as BundledTemplate,
  TemplateSourceMap as RawSourceMap,
} from "@superimg/types";

export type { BundledTemplate, RawSourceMap };

function templateRolldownInput() {
  return templateBundlerInputOptions({
    alias: {
      "superimg/stdlib": "@superimg/stdlib",
      // Scene authoring alias — same real define module as superimg/define.
      "gumbo/media/define": resolveDefinePath(),
    },
  });
}

async function generateTemplateIife(
  bundle: Awaited<ReturnType<typeof rolldown>>,
  ctx: BundlerDebugContext,
  sourcemap: boolean | "inline",
  minify = false,
) {
  const outputOptions = { ...TEMPLATE_IIFE_OUTPUT, sourcemap, minify };
  const bundleMeta: Record<string, unknown> = {
    aliases: templateRolldownInput().resolve.alias,
    outputOptions,
    bundleKeys:
      bundle && typeof bundle === "object"
        ? Object.getOwnPropertyNames(Object.getPrototypeOf(bundle)).concat(
            Object.keys(bundle as object),
          )
        : undefined,
  };
  if (typeof (bundle as { getModules?: () => unknown }).getModules === "function") {
    try {
      const modules = (bundle as { getModules: () => Map<string, unknown> }).getModules();
      bundleMeta.moduleCount = modules.size;
      bundleMeta.moduleIds = [...modules.keys()].slice(0, 20);
    } catch {
      bundleMeta.moduleCount = "getModules-threw";
    }
  }
  logBundlerDebug("rolldown:built", ctx, bundleMeta);
  try {
    const result = await bundle.generate(outputOptions);
    logBundlerDebug("generate:ok", ctx, {
      chunkCount: result.output.length,
      chunks: result.output.map((chunk) => ({
        fileName: chunk.fileName,
        type: chunk.type,
        bytes: "code" in chunk ? chunk.code.length : undefined,
        moduleIds:
          "moduleIds" in chunk && Array.isArray(chunk.moduleIds)
            ? chunk.moduleIds.slice(0, 12)
            : undefined,
      })),
    });
    return result;
  } catch (err) {
    logBundlerDebug("generate:fail", ctx, {
      outputOptions,
      error: err instanceof Error ? err.message : String(err),
      hint: "Re-run with SUPERIMG_BUNDLER_DEBUG=1 for entry + chunk detail",
    });
    throw err;
  }
}

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
export interface BundleTemplateOptions {
  /** Minify the generated IIFE. Intended for distributable preview assets. */
  minify?: boolean;
  /** Defaults to inline so runtime errors retain source context. */
  sourcemap?: boolean | "inline";
}

export async function bundleTemplate(
  entryPoint: string,
  options: BundleTemplateOptions = {},
): Promise<string> {
  const ctx: BundlerDebugContext = {
    kind: "bundleTemplate",
    entry: entryPoint,
  };
  logBundlerEntry(ctx);
  const bundle = await rolldown({
    input: entryPoint,
    plugins: [createSuperimgPlugin()],
    ...templateRolldownInput(),
  });
  try {
    const { output } = await generateTemplateIife(
      bundle,
      ctx,
      options.sourcemap ?? "inline",
      options.minify ?? false,
    );
    return output[0]!.code;
  } finally {
    await bundle.close();
  }
}

/**
 * Bundle a template file and return the code, parsed sourcemap, and source path.
 * Use this when callers need to enrich runtime errors with mapped source locations.
 */
export async function bundleTemplateWithMap(
  entryPoint: string,
): Promise<BundledTemplate> {
  const ctx: BundlerDebugContext = {
    kind: "bundleTemplateWithMap",
    entry: entryPoint,
  };
  logBundlerEntry(ctx);
  const bundle = await rolldown({
    input: entryPoint,
    plugins: [createSuperimgPlugin()],
    ...templateRolldownInput(),
  });
  try {
    const { output } = await generateTemplateIife(bundle, ctx, true);
    const map = output[0]!.map || { version: 3, sources: [], mappings: "" };
    return { code: output[0]!.code, sourceMap: toTemplateSourceMap(map), sourceFile: resolve(entryPoint) };
  } finally {
    await bundle.close();
  }
}

/** Bundle a template file as ESM for browser dynamic import. Server-side only. */
export async function bundleTemplateESM(entryPoint: string): Promise<string> {
  const bundle = await rolldown({
    input: entryPoint,
    plugins: [createSuperimgPlugin()],
    ...templateRolldownInput(),
  });
  try {
    const { output } = await bundle.generate({
      format: "es",
      sourcemap: "inline",
    });
    return output[0]!.code;
  } finally {
    await bundle.close();
  }
}

/** Bundle a template file as ESM and return code + parsed sourcemap + source path. */
export async function bundleTemplateESMWithMap(
  entryPoint: string,
): Promise<BundledTemplate> {
  const bundle = await rolldown({
    input: entryPoint,
    plugins: [createSuperimgPlugin()],
    ...templateRolldownInput(),
  });
  try {
    const { output } = await bundle.generate({
      format: "es",
      sourcemap: true,
    });
    const map = output[0]!.map || { version: 3, sources: [], mappings: "" };
    return { code: output[0]!.code, sourceMap: toTemplateSourceMap(map), sourceFile: resolve(entryPoint) };
  } finally {
    await bundle.close();
  }
}

/** Options for bundling a string of template code. */
export interface BundleTemplateCodeOptions {
  /** Directory used to resolve relative imports inside the template code. */
  resolveDir?: string;
  /**
   * Logical filename for the source code. Used to label the source in the
   * sourcemap (instead of an anonymous `stdin.ts`). Strongly recommended when
   * the caller has a real path on disk for the code.
   */
  sourcefile?: string;
  /** Minify the generated IIFE. Intended for distributable preview assets. */
  minify?: boolean;
  /** Defaults to inline so runtime errors retain source context. */
  sourcemap?: boolean | "inline";
}

/**
 * Build the virtual-entry plugin for bundling code held only as a string.
 *
 * Rolldown has no esbuild-style `stdin` input, so we feed the code through a
 * plugin's `resolveId`/`load` hooks. Critically, the virtual id is a *real*
 * path (derived from `sourcefile`/`resolveDir`), NOT a `\0`-prefixed id:
 * Rolldown (like Rollup) treats `\0`-prefixed modules as synthetic and omits
 * them from the sourcemap, which would leave `sources`/`mappings` empty and
 * break runtime error mapping. Using a real path also lets relative imports in
 * the code resolve against `resolveDir`.
 */
function createStdinEntry(code: string, opts: BundleTemplateCodeOptions): {
  id: string;
  plugin: import("rolldown").Plugin;
} {
  const dir = opts.resolveDir ?? process.cwd();
  const id = resolve(dir, opts.sourcefile ?? "stdin.ts");
  return {
    id,
    plugin: {
      name: "stdin",
      resolveId(source) {
        return source === id ? id : null;
      },
      load(loadId) {
        return loadId === id ? code : null;
      },
    },
  };
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

  const { id, plugin } = createStdinEntry(code, opts);
  const ctx: BundlerDebugContext = {
    kind: "bundleTemplateCode",
    entry: id,
    resolveDir: opts.resolveDir,
    sourcefile: opts.sourcefile,
  };
  logBundlerEntry(ctx);

  const bundle = await rolldown({
    input: id,
    plugins: [plugin, createSuperimgPlugin()],
    ...templateRolldownInput(),
  });
  try {
    const { output } = await generateTemplateIife(
      bundle,
      ctx,
      opts.sourcemap ?? "inline",
      opts.minify ?? false,
    );
    return output[0]!.code;
  } finally {
    await bundle.close();
  }
}

/** Bundle template code from a string and return code + parsed sourcemap + source path. */
export async function bundleTemplateCodeWithMap(
  code: string,
  options: BundleTemplateCodeOptions = {},
): Promise<BundledTemplate> {
  const { id, plugin } = createStdinEntry(code, options);
  const ctx: BundlerDebugContext = {
    kind: "bundleTemplateCodeWithMap",
    entry: id,
    resolveDir: options.resolveDir,
    sourcefile: options.sourcefile,
  };
  logBundlerEntry(ctx);

  const bundle = await rolldown({
    input: id,
    plugins: [plugin, createSuperimgPlugin()],
    ...templateRolldownInput(),
  });
  try {
    const { output } = await generateTemplateIife(bundle, ctx, true);
    const map = output[0]!.map || { version: 3, sources: [], mappings: "" };
    return {
      code: output[0]!.code,
      sourceMap: toTemplateSourceMap(map),
      sourceFile: options.sourcefile ?? "<stdin>",
    };
  } finally {
    await bundle.close();
  }
}
