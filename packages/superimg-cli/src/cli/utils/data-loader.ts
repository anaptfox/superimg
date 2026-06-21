//! Data input loader — turns a `--data` arg or path into a parsed value.
//!
//! Accepts:
//!   - inline JSON string (starts with `{` or `[`)
//!   - path to a `.json` file (read + parsed)
//!   - path to a `.ts` / `.js` file (bundled with esbuild, default-exported)
//!
//! Returns whatever the input describes — caller decides whether to treat it
//! as a single entry (object) or a batch (array).

import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { rolldown } from "rolldown";

/**
 * Bundle and execute a `.ts` / `.js` data file, returning its default export.
 * Bundles as ESM, writes to a temp file, and dynamically imports it.
 */
export async function loadDataScript(filePath: string): Promise<unknown> {
  const fileUrl = pathToFileURL(resolve(filePath)).href;
  const bundle = await rolldown({
    input: filePath,
    plugins: [
      {
        name: "define-import-meta-url",
        transform(code, id) {
          if (code.includes("import.meta.url")) {
            return code.replaceAll("import.meta.url", JSON.stringify(fileUrl));
          }
          return null;
        }
      }
    ]
  });

  let code: string;
  try {
    const { output } = await bundle.generate({
      format: "es",
    });
    code = output[0]!.code;
  } finally {
    await bundle.close();
  }

  const tmpFile = join(tmpdir(), `superimg-data-${randomBytes(8).toString("hex")}.mjs`);

  try {
    writeFileSync(tmpFile, code);
    const mod = await import(tmpFile);
    return mod?.default ?? mod;
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

/**
 * Load a `--data` argument. The value is either inline JSON or a file path.
 *
 * - If the trimmed value starts with `{` or `[`, it is parsed as JSON.
 * - Otherwise it is resolved against `baseDir` (template directory by default)
 *   and loaded by extension: `.json` → JSON.parse, `.ts`/`.js` → esbuild + import.
 *
 * If a function is exported from a `.ts`/`.js` file, it is invoked (with no
 * args) and the awaited result returned.
 */
export async function loadDataInput(arg: string, baseDir: string): Promise<unknown> {
  const trimmed = arg.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch (err) {
      throw new Error(
        `--data: inline value is not valid JSON: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  const filePath = isAbsolute(trimmed) ? trimmed : resolve(baseDir, trimmed);
  if (!existsSync(filePath)) {
    throw new Error(`--data: file not found: ${filePath}`);
  }

  if (filePath.endsWith(".json")) {
    const raw = readFileSync(filePath, "utf-8");
    try {
      return JSON.parse(raw);
    } catch (err) {
      throw new Error(
        `--data: ${filePath} is not valid JSON: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  if (filePath.endsWith(".ts") || filePath.endsWith(".js") || filePath.endsWith(".mjs") || filePath.endsWith(".cjs")) {
    const exported = await loadDataScript(filePath);
    if (typeof exported === "function") {
      return await (exported as () => unknown | Promise<unknown>)();
    }
    return exported;
  }

  throw new Error(
    `--data: unsupported extension for ${filePath}. Use .json, .ts, .js, .mjs, or .cjs (or pass inline JSON).`,
  );
}
