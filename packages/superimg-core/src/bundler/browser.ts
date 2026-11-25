//! Browser-side template bundling with @rolldown/browser (optional peer)

import { createSuperimgPlugin } from "./plugin.browser.js";
import { rethrowBundleFailure } from "./missing-export.js";
import { templateBundlerInputOptions, TEMPLATE_COMPILER_BEHAVIOR, unresolvedImports } from "./rolldown-log.js";
import { toTemplateSourceMap } from "./source-map.js";
import type { TemplateBundle as BundledTemplate, CompilerDiagnostic } from "@superimg/types";
import { createProgramEntry, type MediaProgramSelection } from "./program-entry.js";
import { compilerDiagnostics, normalizeCompilerError } from "../errors/compiler-diagnostics.js";
import { hashBytes } from "../ir/pure/serialize.js";

// Pinned to the exact version superimg is built against: @rolldown/browser is a
// pre-stable WASM bundler whose output must match the native `rolldown` we bundle,
// so the peer version uses the workspace's exact catalog pin.
const ROLLDOWN_PEER_MSG =
  "In-browser compilation requires @rolldown/browser; run pnpm add @rolldown/browser@1.3.1 and enable cross-origin isolation";

export class RolldownPeerMissingError extends Error {
  constructor(cause?: unknown) {
    const detail =
      cause instanceof Error && cause.message
        ? ` (load failed: ${cause.message})`
        : cause
          ? ` (load failed: ${String(cause)})`
          : "";
    super(ROLLDOWN_PEER_MSG + detail);
    this.name = "RolldownPeerMissingError";
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

type RolldownBrowserModule = typeof import("@rolldown/browser");

/**
 * Rolldown's browser binding still defaults `cwd` via `process.cwd()`.
 * Provide a minimal process shim and always pass an explicit browser cwd so
 * live compile does not throw ReferenceError: process is not defined (which
 * was previously misreported as "install @rolldown/browser").
 */
function ensureBrowserProcessShim(): void {
  const g = globalThis as unknown as {
    process?: {
      cwd?: () => string;
      env?: Record<string, string | undefined>;
      versions?: Record<string, string | undefined>;
    };
  };
  if (typeof g.process === "undefined") {
    g.process = {
      cwd: () => "/",
      env: {},
      versions: {},
    };
    return;
  }
  if (typeof g.process.cwd !== "function") {
    g.process.cwd = () => "/";
  }
  if (g.process.env === undefined) g.process.env = {};
  if (g.process.versions === undefined) g.process.versions = {};
}

async function loadRolldownBrowser(): Promise<RolldownBrowserModule> {
  ensureBrowserProcessShim();
  try {
    return await import("@rolldown/browser");
  } catch (err) {
    throw new RolldownPeerMissingError(err);
  }
}

function templateRolldownInput() {
  return {
    // Virtual FS root for browser WASM (must not fall through to process.cwd()).
    cwd: "/",
    platform: "browser" as const,
    ...templateBundlerInputOptions({
      alias: {
        "@foxworth/superimg/stdlib": "@superimg/stdlib",
      },
    }),
  };
}

export class BrowserNotSupportedError extends Error {
  constructor() {
    super("In-browser compilation requires a cross-origin-isolated browser.");
    this.name = "BrowserNotSupportedError";
  }
}

let initPromise: Promise<void> | null = null;

function maskCommentsAndStrings(source: string): string {
  let result = "";
  let index = 0;
  while (index < source.length) {
    const char = source[index]!;
    const next = source[index + 1];
    if (char === "/" && next === "/") {
      const end = source.indexOf("\n", index + 2);
      const stop = end === -1 ? source.length : end;
      result += " ".repeat(stop - index);
      index = stop;
      continue;
    }
    if (char === "/" && next === "*") {
      const closing = source.indexOf("*/", index + 2);
      const stop = closing === -1 ? source.length : closing + 2;
      result += source.slice(index, stop).replace(/[^\n]/g, " ");
      index = stop;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      result += " ";
      index += 1;
      while (index < source.length) {
        const current = source[index]!;
        if (current === "\\") {
          result += " ".repeat(Math.min(2, source.length - index));
          index += 2;
          continue;
        }
        result += current === "\n" ? "\n" : " ";
        index += 1;
        if (current === quote) break;
      }
      continue;
    }
    result += char;
    index += 1;
  }
  return result;
}

function containsCollectionCall(source: string): boolean {
  const code = maskCommentsAndStrings(source);
  const identifier = /\bcollection\b/g;
  for (let match = identifier.exec(code); match; match = identifier.exec(code)) {
    let index = match.index + match[0].length;
    while (/\s/.test(code[index] ?? "")) index += 1;
    if (code[index] === "<") {
      let depth = 0;
      while (index < code.length) {
        const char = code[index++]!;
        if (char === "<") depth += 1;
        else if (char === ">" && --depth === 0) break;
      }
      while (/\s/.test(code[index] ?? "")) index += 1;
    }
    if (code[index] === "(") return true;
  }
  return false;
}

function assertRawBrowserMediaSource(source: string): void {
  if (!containsCollectionCall(source)) return;
  const error = new Error(
    "Collection source must be projected by the SuperImg server compiler before browser compilation",
  ) as Error & { code: string };
  error.name = "MediaSourceAnalysisError";
  error.code = "COLLECTION_REQUIRES_SERVER_PROJECTION";
  throw error;
}

/** Warm-up rolldown. Safe to call multiple times. */
export function initBundler(): Promise<void> {
  if (globalThis.crossOriginIsolated === false) {
    return Promise.reject(new BrowserNotSupportedError());
  }

  if (!initPromise) {
    ensureBrowserProcessShim();
    initPromise = loadRolldownBrowser()
      .then(({ rolldown }) =>
        rolldown({
          input: "\0warmup",
          ...templateRolldownInput(),
          plugins: [
            {
              name: "warmup",
              resolveId(id) {
                return id === "\0warmup" ? id : null;
              },
              load(id) {
                return id === "\0warmup" ? "export {}" : null;
              },
            },
          ],
        }).then((bundle) => bundle.close()),
      )
      .catch((err) => {
        initPromise = null;
        throw err;
      });
  }
  return initPromise;
}

/** Bundle template code in the browser using @rolldown/browser. */
export async function bundleTemplateBrowser(
  code: string,
  options: { selection?: MediaProgramSelection } = {},
): Promise<BundledTemplate> {
  options = { selection: JSON.parse(JSON.stringify(options.selection ?? {})) as MediaProgramSelection };
  assertRawBrowserMediaSource(code);

  if (
    typeof globalThis.crossOriginIsolated !== "undefined" &&
    !globalThis.crossOriginIsolated
  ) {
    throw new BrowserNotSupportedError();
  }

  ensureBrowserProcessShim();
  const { rolldown, VERSION } = await loadRolldownBrowser();

  // Non-`\0` id: Rolldown omits `\0`-prefixed modules from the sourcemap, which
  // would leave the map empty and break blob-URL error mapping in the dev UI.
  const virtualId = "stdin.ts";

  await initBundler();

  const entry = createProgramEntry(virtualId, options.selection);
  const input = templateRolldownInput();
  const diagnostics: CompilerDiagnostic[] = [];
  const unresolved = unresolvedImports(file => file === virtualId);
  let bundle: Awaited<ReturnType<typeof rolldown>> | undefined;
  try {
    bundle = await rolldown({
      input: entry.id,
      ...input,
      onLog(level, log, handler) {
        unresolved.observe(log);
        if (unresolved.isGuessedGlobal(log)) return;
        diagnostics.push(...compilerDiagnostics(log, "transform", virtualId).map(item => ({ ...item, severity: level === "warn" ? "warning" as const : "info" as const })));
        input.onLog(level, log, handler);
      },
      plugins: [
        {
          name: "stdin",
          resolveId(id) { return id === virtualId ? id : null; },
          load(id) { return id === virtualId ? code : null; },
        },
        entry.plugin,
        createSuperimgPlugin(),
      ],
    });
    const { output } = await bundle.generate({
      format: "iife", name: "__template", exports: "named", sourcemap: true, codeSplitting: false,
    });
    unresolved.assertResolved(output);
    const chunk = output.find(item => item.type === "chunk") ?? output[0];
    if (!chunk || !("code" in chunk)) throw new Error("Compiler did not emit a media program");
    const projectionIdentity = hashBytes(code);
    return {
      code: chunk.code,
      sourceMap: toTemplateSourceMap(chunk.map || { version: 3, sources: [], mappings: "" }),
      sourceFile: "<browser>", projectionIdentity,
      inputIdentity: hashBytes(JSON.stringify([projectionIdentity, TEMPLATE_COMPILER_BEHAVIOR, VERSION, options.selection ?? {}])),
      outputIdentity: hashBytes(chunk.code), diagnostics: Object.freeze(diagnostics),
    };
  } catch (error) {
    const records = [...compilerDiagnostics(error, "generate", virtualId), ...diagnostics];
    let failure = error;
    try { rethrowBundleFailure(error); } catch (mapped) { failure = mapped; }
    if (failure && typeof failure === "object") Object.assign(failure, { compilerDiagnostics: records });
    throw normalizeCompilerError(failure, "generate", virtualId);
  } finally { await bundle?.close(); }
}
