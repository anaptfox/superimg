//! Browser-side template bundling with @rolldown/browser (optional peer)

import { createSuperimgPlugin } from "./plugin.browser.js";
import { templateBundlerInputOptions } from "./rolldown-log.js";
import { toTemplateSourceMap } from "./source-map.js";
import type { TemplateBundle as BundledTemplate } from "@superimg/types";

// Pinned to the exact version superimg is built against: @rolldown/browser is a
// pre-stable WASM bundler whose output must match the native `rolldown` we bundle,
// so the peer range in package.json is exact (1.1.3), not a caret range.
const ROLLDOWN_PEER_MSG =
  "In-browser compilation requires @rolldown/browser; run pnpm add @rolldown/browser@1.1.3 and enable cross-origin isolation";

export class RolldownPeerMissingError extends Error {
  constructor() {
    super(ROLLDOWN_PEER_MSG);
    this.name = "RolldownPeerMissingError";
  }
}

type RolldownBrowserModule = typeof import("@rolldown/browser");

async function loadRolldownBrowser(): Promise<RolldownBrowserModule> {
  try {
    return await import("@rolldown/browser");
  } catch {
    throw new RolldownPeerMissingError();
  }
}

function templateRolldownInput() {
  return templateBundlerInputOptions({
    alias: {
      "superimg/stdlib": "@superimg/stdlib",
      // Resolved by the browser plugin virtual module (no node:path).
      "gumbo/media/define": "superimg/define",
    },
  });
}

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
    initPromise = loadRolldownBrowser()
      .then(({ rolldown }) =>
        rolldown({
          input: "\0warmup",
          tsconfig: false,
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
): Promise<BundledTemplate> {
  if (
    typeof globalThis.crossOriginIsolated !== "undefined" &&
    !globalThis.crossOriginIsolated
  ) {
    throw new BrowserNotSupportedError();
  }

  const { rolldown } = await loadRolldownBrowser();

  // Non-`\0` id: Rolldown omits `\0`-prefixed modules from the sourcemap, which
  // would leave the map empty and break blob-URL error mapping in the dev UI.
  const virtualId = "stdin.ts";

  await initBundler();

  const bundle = await rolldown({
    input: virtualId,
    ...templateRolldownInput(),
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
        },
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
      codeSplitting: false,
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