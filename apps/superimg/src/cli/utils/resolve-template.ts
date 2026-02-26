//! Smart template path resolution for CLI commands
//!
//! Resolves bare names through videos/:
//!   superimg dev intro        -> videos/intro.ts or videos/intro.js
//!   superimg dev intro.ts     -> videos/intro.ts
//!   superimg dev ./path.ts    -> explicit path
//!   superimg dev /abs/path.ts -> explicit path

import { resolve, join } from "node:path";
import { existsSync, readdirSync } from "node:fs";

/**
 * Resolve template path. Bare names (no ./, /, or path separator) are resolved
 * through videos/{name}.ts, videos/{name}.js, videos/{name}/index.ts, videos/{name}/index.js.
 */
export function resolveTemplatePath(input: string, cwd = process.cwd()): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Template path cannot be empty.");
  }

  // Explicit path: starts with ./, /, or contains path separator
  if (trimmed.startsWith("./") || trimmed.startsWith("/") || trimmed.includes("/")) {
    const resolved = resolve(cwd, trimmed);
    if (!existsSync(resolved)) {
      throw new Error(`Template file not found: ${resolved}`);
    }
    return resolved;
  }

  // Bare name: resolve through videos/
  const baseName = trimmed.endsWith(".ts") || trimmed.endsWith(".js")
    ? trimmed.slice(0, -3)
    : trimmed;

  const candidates = [
    join(cwd, "videos", `${baseName}.ts`),
    join(cwd, "videos", `${baseName}.js`),
    join(cwd, "videos", baseName, "index.ts"),
    join(cwd, "videos", baseName, "index.js"),
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  // Not found: list available templates in videos/
  const videosDir = join(cwd, "videos");
  let hint = "";
  if (existsSync(videosDir)) {
    try {
      const entries = readdirSync(videosDir, { withFileTypes: true });
      const templates = entries
        .filter((e) => e.isFile() && (e.name.endsWith(".ts") || e.name.endsWith(".js")))
        .map((e) => e.name.replace(/\.(ts|js)$/, ""))
        .concat(
          entries
            .filter((e) => e.isDirectory())
            .map((e) => `${e.name}/`)
        );
      if (templates.length > 0) {
        hint = `\nAvailable templates in videos/: ${templates.join(", ")}`;
      }
    } catch {
      // Ignore read errors
    }
  } else {
    hint = `\nNo videos/ directory found. Run 'superimg init --add' to create one.`;
  }

  throw new Error(
    `Template not found: "${trimmed}". Tried videos/${baseName}.ts, videos/${baseName}.js, videos/${baseName}/index.ts, videos/${baseName}/index.js.${hint}`
  );
}
