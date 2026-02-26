//! Server-side template bundling with esbuild (Node/Bun/Deno)

import * as esbuild from "esbuild";
import { createSuperimgPlugin } from "./bundler-plugin.js";

/** Bundle a template file, resolving all imports. Server-side only (Node/Bun/Deno). */
export async function bundleTemplate(entryPoint: string): Promise<string> {
  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    format: "iife",
    globalName: "__template",
    platform: "neutral",
    target: "es2020",
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
    platform: "neutral",
    target: "es2020",
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
    platform: "neutral",
    target: "es2020",
    plugins: [createSuperimgPlugin()],
  });
  return result.outputFiles[0]!.text;
}
