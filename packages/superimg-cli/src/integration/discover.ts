import { dirname, basename, isAbsolute } from "node:path";
import { readFileSync, unlinkSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { rolldown } from "rolldown";
import type { Plugin } from "rolldown";
import { writeFileRecursive } from "../utils/fs.js";
import { discoverVideos } from "../cli/utils/discover-videos.js";
import type { BatchProvider } from "@superimg/types";

export interface DiscoverBatchOptions {
  /** Extra rolldown plugins (e.g. a host stub for its own imports). */
  plugins?: Plugin[];
}

export interface DiscoveredBatch {
  /** Absolute path to the template file that exports `batch`. */
  entrypoint: string;
  /** The resolved batch provider (call it to get the entries). */
  batch: BatchProvider<any>;
}

// Quick source pre-filter: only bundle+import templates that look like they
// export `batch`, so we don't execute every template just to check.
function mentionsBatchExport(source: string): boolean {
  return (
    /export\s+(?:const|let|var|async\s+function|function)\s+batch\b/.test(source) ||
    /export\s*\{[^}]*\bbatch\b[^}]*\}/.test(source)
  );
}

// Stub `superimg` so discovery only needs the `batch` provider — the template's
// define*() calls become identity and the (unused) default export is harmless.
// `defineBatch(template, fn)` returns `fn`, so `mod.batch` is directly callable.
const superimgStub: Plugin = {
  name: "superimg-discover-stub",
  resolveId(id) {
    if (id === "superimg") {
      return "\0superimg-stub";
    }
    return null;
  },
  load(id) {
    if (id === "\0superimg-stub") {
      return [
        "export const defineImage = (c) => c;",
        "export const defineScene = (c) => c;",
        "export const defineSvg = (c) => c;",
        "export const defineGif = (c) => c;",
        "export const defineConfig = (c) => c;",
        "export const defineBatch = (_t, fn) => fn;",
      ].join("\n");
    }
    return null;
  }
};

/**
 * Discover templates that carry a co-located `export const batch`.
 *
 * Each candidate is bundled (relative imports inlined so a lazy
 * `await import("../content")` resolves at build time; bare deps stay external)
 * and imported to read its `batch` provider.
 */
export async function discoverBatchSources(
  projectRoot: string,
  options: DiscoverBatchOptions = {},
): Promise<DiscoveredBatch[]> {
  const templates = discoverVideos(projectRoot);
  const results: DiscoveredBatch[] = [];

  for (const tpl of templates) {
    let source: string;
    try {
      source = readFileSync(tpl.entrypoint, "utf8");
    } catch {
      continue;
    }
    if (!mentionsBatchExport(source)) continue;

    const dir = dirname(tpl.entrypoint);
    const tempPath = `${dir}/.${basename(tpl.entrypoint).replace(/\.(ts|js)$/, "")}.batch.mjs`;

    let bundle;
    let code: string;
    try {
      bundle = await rolldown({
        input: tpl.entrypoint,
        external: (id) => !id.startsWith(".") && !isAbsolute(id) && id !== "\0superimg-stub" && id !== "superimg",
        plugins: [superimgStub, ...(options.plugins ?? [])],
      });
      const { output } = await bundle.generate({ format: "es" });
      code = output[0]!.code;
    } catch {
      continue; // a template that won't bundle simply has no discoverable batch
    } finally {
      if (bundle) await bundle.close();
    }

    if (!code) continue;
    writeFileRecursive(tempPath, code);

    try {
      const mod = await import(pathToFileURL(tempPath).href);
      if (typeof mod.batch === "function") {
        results.push({ entrypoint: tpl.entrypoint, batch: mod.batch });
      }
    } catch {
      // ignore templates whose batch module fails to load
    } finally {
      try {
        unlinkSync(tempPath);
      } catch {}
    }
  }

  return results;
}
