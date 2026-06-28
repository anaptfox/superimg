//! Browser-side template bundling with @rolldown/browser

import { rolldown } from "@rolldown/browser";
import { createSuperimgPlugin } from "./plugin.browser.js";
import { toTemplateSourceMap } from "./source-map.js";
import type { TemplateBundle as BundledTemplate } from "@superimg/types";

const templateImportAliases = {
  "superimg/stdlib": "@superimg/stdlib",
};

export class BrowserNotSupportedError extends Error {
  constructor() {
    super("In-browser compilation requires a cross-origin-isolated browser.");
    this.name = "BrowserNotSupportedError";
  }
}

let initPromise: Promise<void> | null = null;

/** Warm-up rolldown. Safe to call multiple times. */
export function initBundler(): Promise<void> {
  if (globalThis.crossOriginIsolated === false) {
    return Promise.reject(new BrowserNotSupportedError());
  }
  
  if (!initPromise) {
    // Perform a no-op warmup build to download and instantiate the WASM
    initPromise = rolldown({
      input: "\0warmup",
      plugins: [{
        name: "warmup",
        resolveId(id) { return id === "\0warmup" ? id : null; },
        load(id) { return id === "\0warmup" ? "export {}" : null; }
      }]
    }).then(bundle => bundle.close()).catch(err => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

/** Bundle template code in the browser using @rolldown/browser. */
export async function bundleTemplateBrowser(
  code: string,
): Promise<BundledTemplate> {
  if (typeof globalThis.crossOriginIsolated !== "undefined" && !globalThis.crossOriginIsolated) {
    throw new BrowserNotSupportedError();
  }

  // Non-`\0` id: Rolldown omits `\0`-prefixed modules from the sourcemap, which
  // would leave the map empty and break blob-URL error mapping in the dev UI.
  const virtualId = "stdin.ts";

  await initBundler();

  const bundle = await rolldown({
    input: virtualId,
    resolve: { alias: templateImportAliases },
    plugins: [
      {
        name: "stdin",
        resolveId(id) {
          if (id === virtualId) return id;
          return null;
        },
        load(id) {
          if (id === virtualId) return code;
          return null;
        }
      },
      createSuperimgPlugin(),
    ],
  });

  try {
    const { output } = await bundle.generate({
      format: "iife",
      name: "__template",
      exports: "named",
      sourcemap: true,
    });
    
    const map = output[0]!.map || { version: 3, sources: [], mappings: "" };
    
    return {
      code: output[0]!.code,
      sourceMap: toTemplateSourceMap(map),
      sourceFile: "<browser>",
    };
  } finally {
    await bundle.close();
  }
}
