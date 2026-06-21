import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { rolldown } from "rolldown";

export async function fingerprint(entrypoint: string, extra?: unknown): Promise<string> {
  const hash = createHash("sha256");
  try {
    // Bundle to capture transitive deps — a changed helper invalidates the hash
    const bundle = await rolldown({
      input: entrypoint,
    });
    try {
      const { output } = await bundle.generate({ format: "es" });
      hash.update(output[0]!.code);
    } finally {
      await bundle.close();
    }
  } catch {
    try {
      hash.update(readFileSync(entrypoint, "utf8"));
    } catch {
      hash.update(entrypoint);
    }
  }
  if (extra !== undefined) {
    hash.update(JSON.stringify(extra));
  }
  return hash.digest("hex").slice(0, 16);
}

export class RenderCache {
  private cache: Map<string, string> = new Map();
  private cacheFile: string;

  constructor(cacheDir: string) {
    this.cacheFile = join(cacheDir, "render-cache.json");
    this.load();
  }

  load() {
    if (existsSync(this.cacheFile)) {
      try {
        const data = JSON.parse(readFileSync(this.cacheFile, "utf8"));
        this.cache = new Map(Object.entries(data));
      } catch {
        this.cache = new Map();
      }
    }
  }

  save() {
    mkdirSync(dirname(this.cacheFile), { recursive: true });
    const obj = Object.fromEntries(this.cache);
    writeFileSync(this.cacheFile, JSON.stringify(obj, null, 2));
  }

  isFresh(key: string, fp: string, outputPaths?: string[]): boolean {
    if (this.cache.get(key) !== fp) return false;
    if (outputPaths && outputPaths.length > 0) {
      return outputPaths.every((p) => existsSync(p));
    }
    return true;
  }

  set(key: string, fp: string) {
    this.cache.set(key, fp);
  }

  prune(validKeys: string[]) {
    const valid = new Set(validKeys);
    for (const key of this.cache.keys()) {
      if (!valid.has(key)) {
        this.cache.delete(key);
      }
    }
  }
}
