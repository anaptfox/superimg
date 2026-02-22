//! Browser-side template bundling with esbuild-wasm

import * as esbuild from "esbuild-wasm";
import { createSuperimgPlugin } from "./bundler-plugin.js";

const ESBUILD_WASM_VERSION = "0.27.3";
const DEFAULT_WASM_URL = `https://unpkg.com/esbuild-wasm@${ESBUILD_WASM_VERSION}/esbuild.wasm`;

let initPromise: Promise<void> | null = null;

/** Initialize esbuild-wasm. Defaults to CDN; pass a URL to self-host. Safe to call multiple times. */
export function initBundler(wasmURL: string = DEFAULT_WASM_URL): Promise<void> {
  if (!initPromise) {
    initPromise = esbuild.initialize({ wasmURL, worker: true }).catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

/** Bundle template code in the browser using esbuild-wasm. Auto-initializes if needed. */
export async function bundleTemplateBrowser(code: string): Promise<string> {
  await initBundler();

  const result = await esbuild.build({
    stdin: { contents: code, loader: "ts" },
    bundle: true,
    write: false,
    format: "iife",
    globalName: "__template",
    target: "es2020",
    plugins: [createSuperimgPlugin()],
  });
  return result.outputFiles[0]!.text;
}
