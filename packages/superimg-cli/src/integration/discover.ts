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
  batch: BatchProvider;
}

// Quick source pre-filter: only bundle+import templates that look like they
// export `batch`, so we don't execute every template just to check.
function mentionsBatchExport(source: string): boolean {
  return (
    /export\s+(?:const|let|var|async\s+function|function)\s+batch\b/.test(source) ||
    /export\s*\{[^}]*\bbatch\b[^}]*\}/.test(source)
  );
}

// Stub `superimg` / `gumbo/media/define` so discovery only needs the `batch` provider —
// the template's define() call becomes identity and the (unused) default export
// is harmless. `defineBatch(template, fn)` returns `fn`, so `mod.batch` is
// directly callable.
const superimgStub: Plugin = {
  name: "superimg-discover-stub",
  resolveId(id) {
    if (id === "superimg" || id === "gumbo/media/define" || id === "gumbo/media") {
      return "\0superimg-stub";
    }
    return null;
  },
  load(id) {
    if (id === "\0superimg-stub") {
      return [
        "export const define = (c) => c;",
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
 *
 * Throws when a template mentions `batch` but bundling or import fails.
 */
export async function discoverBatchSources(
  projectRoot: string,
  options: DiscoverBatchOptions = {},
): Promise<DiscoveredBatch[]> {
  const templates = discoverVideos(projectRoot);
  const results: DiscoveredBatch[] = [];
  const errors: string[] = [];

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
    let code: string | undefined;
    try {
      bundle = await rolldown({
        input: tpl.entrypoint,
        tsconfig: false,
        external: (id) =>
          !id.startsWith(".") &&
          !isAbsolute(id) &&
          id !== "\0superimg-stub" &&
          id !== "superimg" &&
          id !== "gumbo/media/define" &&
          id !== "gumbo/media",
        plugins: [superimgStub, ...(options.plugins ?? [])],
      });
      // Single chunk so lazy `import("../content")` is inlined — otherwise rolldown
      // emits a sibling chunk (e.g. content-*.js) we never write next to the temp file.
      const { output } = await bundle.generate({ format: "es", codeSplitting: false });
      code = output[0]!.code;
    } catch (e) {
      errors.push(`${tpl.entrypoint}: failed to bundle batch provider — ${String(e)}`);
      continue;
    } finally {
      if (bundle) await bundle.close();
    }

    if (!code) {
      errors.push(`${tpl.entrypoint}: batch bundle produced no output`);
      continue;
    }
    writeFileRecursive(tempPath, code);

    try {
      const mod = await import(pathToFileURL(tempPath).href);
      if (typeof mod.batch === "function") {
        results.push({ entrypoint: tpl.entrypoint, batch: mod.batch });
      } else {
        errors.push(`${tpl.entrypoint}: exports batch but it is not a function`);
      }
    } catch (e) {
      errors.push(`${tpl.entrypoint}: failed to load batch module — ${String(e)}`);
    } finally {
      try {
        unlinkSync(tempPath);
      } catch {}
    }
  }

  if (errors.length > 0) {
    throw new Error(`Batch discovery failed:\n${errors.join("\n")}`);
  }

  return results;
}