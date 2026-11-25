import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { validateMediaIR } from "@superimg/core";
import type { MediaIR } from "@superimg/types";

export interface BaselineMeta {
  sourceId: string;
  programHash: string;
  intentHash: string;
  markupHash: string;
  savedAt: string;
  sourcePath: string;
}

/** A host-selected store root. Saves replace two files; interruption may leave a detectable incomplete or mismatched pair. */
export function createBaselineStore(root: string) {
  const base = resolve(root);
  function path(id: string): string {
    if (!id || id.startsWith(".") || /[\\/\x00]/.test(id)) throw new TypeError("Invalid baseline source ID");
    return join(base, id);
  }
  async function withLock<T>(id: string, action: () => Promise<T>): Promise<T> {
    path(id);
    await mkdir(base, { recursive: true });
    const lock = join(base, `.${id}.lock`);
    try { await mkdir(lock); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error(`BASELINE_LOCKED: ${id}`);
      throw error;
    }
    try { return await action(); }
    finally { await rm(lock, { recursive: true, force: true }); }
  }
  async function read(id: string): Promise<{ media: MediaIR; meta: BaselineMeta } | null> {
    const dir = path(id);
    const [mediaText, metaText] = await Promise.all(["media.json", "meta.json"].map(async name => {
      try { return await readFile(join(dir, name), "utf8"); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
    }));
    if (mediaText === undefined && metaText === undefined) return null;
    if (mediaText === undefined || metaText === undefined) throw new Error(`BASELINE_INCOMPLETE: ${id}`);
    const media = validateMediaIR(JSON.parse(mediaText));
    const meta = JSON.parse(metaText) as BaselineMeta;
    if (!meta || meta.sourceId !== id || typeof meta.sourcePath !== "string" || typeof meta.savedAt !== "string" || meta.programHash !== media.hashes.programHash || meta.intentHash !== media.hashes.intentHash || meta.markupHash !== media.hashes.markupHash) throw new Error(`BASELINE_MISMATCH: ${id}`);
    return { media, meta };
  }
  async function save(input: { sourceId: string; sourcePath: string; media: MediaIR; savedAt?: string }): Promise<{ path: string; meta: BaselineMeta }> {
    const dir = path(input.sourceId);
    const media = validateMediaIR(input.media);
    return withLock(input.sourceId, async () => {
      const previous = await read(input.sourceId);
      if (previous && resolve(previous.meta.sourcePath) !== resolve(input.sourcePath)) throw new Error(`BASELINE_COLLISION: ${input.sourceId} already belongs to ${previous.meta.sourcePath}`);
      const meta: BaselineMeta = { sourceId: input.sourceId, sourcePath: input.sourcePath, savedAt: input.savedAt ?? new Date().toISOString(), ...media.hashes };
      await mkdir(dir, { recursive: true });
      const token = randomUUID();
      const mediaTmp = join(dir, `.media-${token}.tmp`);
      const metaTmp = join(dir, `.meta-${token}.tmp`);
      try {
        await writeFile(mediaTmp, JSON.stringify(media), { flag: "wx" });
        await writeFile(metaTmp, `${JSON.stringify(meta, null, 2)}\n`, { flag: "wx" });
        await rename(mediaTmp, join(dir, "media.json"));
        await rename(metaTmp, join(dir, "meta.json"));
      } finally { await Promise.all([rm(mediaTmp, { force: true }), rm(metaTmp, { force: true })]); }
      return { path: dir, meta };
    });
  }
  async function list(): Promise<BaselineMeta[]> {
    let entries;
    try { entries = await readdir(base, { withFileTypes: true }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
    const result: BaselineMeta[] = [];
    for (const entry of entries) if (entry.isDirectory() && !entry.name.startsWith(".")) { const item = await read(entry.name); if (item) result.push(item.meta); }
    return result;
  }
  // clearAll requires caller-enforced exclusive access to the entire store.
  return { read, save, list, clear: async (id: string) => withLock(id, () => rm(path(id), { recursive: true, force: true })), clearAll: async () => rm(base, { recursive: true, force: true }) };
}
