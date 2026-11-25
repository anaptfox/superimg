//! IR-hash-keyed cache for internal frame rendering.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { hashBytes } from "@superimg/core";

export const RENDER_CACHE_SCHEMA = 0 as const;
export const RENDER_CACHE_DIR = ".superimg-cache";
export const RENDER_CACHE_FILE = "render-cache.json";

export interface RenderCacheEntry {
  intentHash: string;
  markupHash: string;
  programHash: string;
  /** Hash of format + encoding opts only (not width/height/fps/data — those are in IR). */
  renderKey: string;
  outputPaths: string[];
  outputHashes: Record<string, string>;
  renderedAt: string;
}

export interface RenderCacheManifest {
  schemaVersion: typeof RENDER_CACHE_SCHEMA;
  cliVersion: string;
  entries: Record<string, RenderCacheEntry>;
}

export function computeRenderKey(opts: {
  format?: string;
  encoding?: Record<string, unknown>;
}): string {
  return hashBytes(
    JSON.stringify({
      format: opts.format ?? "mp4",
      encoding: opts.encoding ?? {},
    }),
  );
}

export function cacheEntryKey(sourceId: string): string {
  return sourceId;
}

export function hashFile(path: string): string | null {
  try {
    return hashBytes(readFileSync(path));
  } catch {
    return null;
  }
}

export class RenderIRCache {
  private manifest: RenderCacheManifest;
  private readonly cachePath: string;
  private dirty = false;

  constructor(
    private readonly outDir: string,
    private readonly cliVersion: string,
  ) {
    this.cachePath = join(outDir, RENDER_CACHE_DIR, RENDER_CACHE_FILE);
    this.manifest = this.load();
  }

  private load(): RenderCacheManifest {
    if (!existsSync(this.cachePath)) {
      return {
        schemaVersion: RENDER_CACHE_SCHEMA,
        cliVersion: this.cliVersion,
        entries: {},
      };
    }
    try {
      const raw = JSON.parse(readFileSync(this.cachePath, "utf8")) as RenderCacheManifest;
      if (raw.schemaVersion !== RENDER_CACHE_SCHEMA || raw.cliVersion !== this.cliVersion) {
        return {
          schemaVersion: RENDER_CACHE_SCHEMA,
          cliVersion: this.cliVersion,
          entries: {},
        };
      }
      return raw;
    } catch {
      return {
        schemaVersion: RENDER_CACHE_SCHEMA,
        cliVersion: this.cliVersion,
        entries: {},
      };
    }
  }

  save(): void {
    if (!this.dirty) return;
    mkdirSync(dirname(this.cachePath), { recursive: true });
    writeFileSync(this.cachePath, JSON.stringify(this.manifest, null, 2) + "\n");
    this.dirty = false;
  }

  lookup(key: string): RenderCacheEntry | undefined {
    return this.manifest.entries[key];
  }

  /**
   * Fresh when IR hashes + renderKey match and all output files exist with same hashes.
   */
  isFresh(
    key: string,
    hashes: { intentHash: string; markupHash: string; programHash: string },
    renderKey: string,
  ): boolean {
    const e = this.manifest.entries[key];
    if (!e) return false;
    if (
      e.intentHash !== hashes.intentHash ||
      e.markupHash !== hashes.markupHash ||
      e.programHash !== hashes.programHash ||
      e.renderKey !== renderKey
    ) {
      return false;
    }
    for (const path of e.outputPaths) {
      if (!existsSync(path)) return false;
      const h = hashFile(path);
      if (!h || h !== e.outputHashes[path]) return false;
    }
    return true;
  }

  record(
    key: string,
    hashes: { intentHash: string; markupHash: string; programHash: string },
    renderKey: string,
    outputPaths: string[],
  ): void {
    const outputHashes: Record<string, string> = {};
    for (const p of outputPaths) {
      const h = hashFile(p);
      if (h) outputHashes[p] = h;
    }
    this.manifest.entries[key] = {
      ...hashes,
      renderKey,
      outputPaths: [...outputPaths],
      outputHashes,
      renderedAt: new Date().toISOString(),
    };
    this.dirty = true;
  }

  pruneMissing(): number {
    let n = 0;
    for (const [k, e] of Object.entries(this.manifest.entries)) {
      if (e.outputPaths.some((p) => !existsSync(p))) {
        delete this.manifest.entries[k];
        n++;
        this.dirty = true;
      }
    }
    return n;
  }
}
