//! Server-side template bundling with esbuild (Node/Bun/Deno)

import * as esbuild from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createSuperimgPlugin } from "./plugin.js";

// Find the stdlib package location for resolution
// This file is at packages/superimg-core/dist/bundler.js
// The stdlib is at packages/superimg-stdlib (symlinked in node_modules)
const __dirname = dirname(fileURLToPath(import.meta.url));
// Go from dist/ to packages/superimg-core/node_modules
const stdlibNodePath = resolve(__dirname, "../node_modules");

/** Bundle a template file, resolving all imports. Server-side only (Node/Bun/Deno). */
export async function bundleTemplate(entryPoint: string): Promise<string> {
  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    format: "iife",
    globalName: "__template",
    platform: "node",
    target: "es2020",
    nodePaths: stdlibNodePath ? [stdlibNodePath] : [],
    plugins: [createSuperimgPlugin()],
  });
  return result.outputFiles[0]!.text;
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
    nodePaths: stdlibNodePath ? [stdlibNodePath] : [],
    plugins: [createSuperimgPlugin()],
  });
  return result.outputFiles[0]!.text;
}

/** Bundle template code from a string. Server-side only. */
export async function bundleTemplateCode(
  code: string,
  resolveDir?: string
): Promise<string> {
  const result = await esbuild.build({
    stdin: {
      contents: code,
      loader: "ts",
      resolveDir: resolveDir ?? (globalThis.process?.cwd?.() ?? (globalThis as any).Deno?.cwd?.() ?? "/"),
    },
    bundle: true,
    write: false,
    format: "iife",
    globalName: "__template",
    platform: "node",
    target: "es2020",
    nodePaths: stdlibNodePath ? [stdlibNodePath] : [],
    plugins: [createSuperimgPlugin()],
  });
  return result.outputFiles[0]!.text;
}
