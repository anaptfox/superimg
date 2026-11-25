//! Assemble a self-contained container runtime for OCI deploy context.
//! Copies dist entry + local import closure + a production package.json so the
//! image can `npm install` Linux-native deps (sharp and playwright).

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { readOciRelease, type OciRelease } from "./oci-release.js";

const require = createRequire(import.meta.url);

declare const __SUPERIMG_OCI_RELEASE__: OciRelease;

export interface AssembleOciRuntimeOptions {
  /** Directory that will contain package.json + dist/ (OCI build context root or subdirectory). */
  outDir: string;
  /** Path to packages/superimg-cli/dist (default: sibling of this module's package). */
  cliDistDir?: string;
}

/**
 * Resolve @foxworth/superimg-cli dist directory from the monorepo layout.
 */
export function defaultCliDistDir(): string {
  // assemble-oci-runtime.ts lives in src/deploy → package root is ../..
  const here = dirname(fileURLToPath(import.meta.url));
  // When running from dist: packages/superimg-cli/dist/assemble-oci-runtime.js
  // When running from src via tsx: packages/superimg-cli/src/deploy/
  const candidates = [
    resolve(here, "../container.js"), // dist/ next to assembled entry
    resolve(here, "../../dist"), // src/deploy → dist
    resolve(here, "dist"),
  ];
  for (const c of candidates) {
    if (c.endsWith("container.js") && existsSync(c)) {
      return dirname(c);
    }
    if (existsSync(join(c, "container.js"))) return c;
  }
  // Fallback: package root dist via require resolve of package.json
  try {
    const pkgJson = require.resolve("@foxworth/superimg-cli/package.json");
    return join(dirname(pkgJson), "dist");
  } catch {
    /* monorepo path */
  }
  return resolve(here, "../../dist");
}

/**
 * Walk local relative imports starting at entry files; return set of .js paths.
 */
export function collectLocalJsClosure(
  distDir: string,
  entries: string[],
): string[] {
  const seen = new Set<string>();
  const queue = [...entries];

  while (queue.length > 0) {
    const rel = queue.pop()!;
    const abs = join(distDir, rel);
    if (seen.has(rel) || !existsSync(abs)) continue;
    seen.add(rel);
    const code = readFileSync(abs, "utf8");
    // Rolldown preserves the Webpack/Turbopack hints on lazy runtime imports.
    const importRe =
      /\b(?:from\s*|import\s*(?:\((?:\s|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*)*)?)(["'`])(\.[^"'`\r\n]+)\1/g;
    for (const match of code.matchAll(importRe)) {
      let spec = match[2]!;
      if (!spec.endsWith(".js") && !spec.endsWith(".mjs") && !spec.endsWith(".cjs")) {
        spec = `${spec}.js`;
      }
      const resolved = resolve(dirname(abs), spec);
      const relNext = relative(distDir, resolved);
      if (
        !relNext.startsWith("..") &&
        !seen.has(relNext) &&
        existsSync(resolved)
      ) {
        queue.push(relNext);
      }
    }
  }

  return [...seen].sort();
}

/**
 * Write OCI runtime package.json + dist/ into outDir.
 */
export function assembleOciRuntime(options: AssembleOciRuntimeOptions): {
  files: string[];
  packageJsonPath: string;
  distDir: string;
  nodeVersion: string;
  playwrightVersion: string;
} {
  const distSrc = options.cliDistDir ?? defaultCliDistDir();
  if (!existsSync(join(distSrc, "container.js"))) {
    throw new Error(
      `OCI assemble: missing container.js in ${distSrc}. Build @foxworth/superimg-cli first.`,
    );
  }

  const release = typeof __SUPERIMG_OCI_RELEASE__ === "undefined"
    ? readOciRelease(new URL("../../", import.meta.url))
    : __SUPERIMG_OCI_RELEASE__;
  const outDir = options.outDir;
  const distOut = join(outDir, "dist");
  mkdirSync(distOut, { recursive: true });

  const entries = ["container.js", "container-worker.js"].filter((f) =>
    existsSync(join(distSrc, f)),
  );
  const files = collectLocalJsClosure(distSrc, entries);

  for (const rel of files) {
    const src = join(distSrc, rel);
    const dest = join(distOut, rel);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest);
    // source maps optional
    const map = `${src}.map`;
    if (existsSync(map)) {
      cpSync(map, `${dest}.map`);
    }
  }

  // Also copy any .wasm that sits next to dist (rare)
  for (const name of readdirSync(distSrc)) {
    if (name.endsWith(".wasm")) {
      cpSync(join(distSrc, name), join(distOut, name));
      files.push(name);
    }
  }

  const pkg = {
    name: "superimg-oci-runtime",
    version: "0.1.0",
    private: true,
    type: "module",
    main: "dist/container.js",
    scripts: {
      start: "node dist/container.js",
    },
    dependencies: release.dependencies,
  };

  const packageJsonPath = join(outDir, "package.json");
  writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);

  return {
    files, packageJsonPath, distDir: distOut,
    nodeVersion: release.nodeVersion,
    playwrightVersion: release.dependencies.playwright,
  };
}

/** Byte size of assembled dist for smoke assertions. */
export function distByteSize(distDir: string): number {
  let n = 0;
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else n += st.size;
    }
  };
  walk(distDir);
  return n;
}
