import { createHash } from "node:crypto";
import { createReadStream, type ReadStream } from "node:fs";
import { chmod, mkdtemp, open, rm, stat, type FileHandle } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import type { RuntimeArtifactBacking } from "@superimg/core/runtime";

/** Maximum on-disk output size for native media conversions and cuts. */
export const DEFAULT_MEDIA_OUTPUT_BYTES = 512 * 1024 * 1024;

/** Positioned writes open lazily, so canceled preflight owns no file handle. */
export async function allocateMediaTarget(media: typeof import("mediabunny"), extension: string, limit = DEFAULT_MEDIA_OUTPUT_BYTES) {
  const storage = new ExportArtifactStorage();
  try {
    const path = await storage.allocate(extension);
    let file: FileHandle | undefined;
    const close = async () => { const handle = file; file = undefined; await handle?.close(); };
    const writable = new WritableStream<import("mediabunny").StreamTargetChunk>({
      async write(chunk) {
        try {
          if (chunk.position < 0 || chunk.position + chunk.data.byteLength > limit) throw new RangeError("Media output exceeds byte limit");
          file ??= await open(path, "w", 0o600);
          let offset = 0;
          while (offset < chunk.data.byteLength) {
            const written = await file.write(chunk.data, offset, chunk.data.byteLength - offset, chunk.position + offset);
            if (written.bytesWritten === 0) throw new Error("Media output write made no progress");
            offset += written.bytesWritten;
          }
        } catch (error) { await close(); throw error; }
      },
      close,
      abort: close,
    });
    const target = new media.StreamTarget(writable, { chunked: true });
    return { storage, path, target };
  } catch (error) { await storage.dispose(); throw error; }
}

/** A job owns this directory until a complete export bundle adopts it. */
export class ExportArtifactStorage {
  private directory: Promise<string> | undefined;
  private readonly readers = new Set<ReadStream>();
  private disposed = false;
  private disposal: Promise<void> | undefined;
  private nextFile = 0;

  async allocate(extension: string): Promise<string> {
    if (this.disposed) throw new Error("Export storage is disposed");
    if (!/^[a-z0-9]+$/.test(extension)) throw new TypeError("Invalid artifact extension");
    this.directory ??= mkdtemp(join(tmpdir(), "superimg-export-"));
    const directory = await this.directory;
    if (this.disposed) throw new Error("Export storage is disposed");
    return join(directory, `${this.nextFile++}.${extension}`);
  }

  async seal(path: string, signal?: AbortSignal, known?: { byteLength: number; sha256: string }): Promise<RuntimeArtifactBacking> {
    if (this.disposed || !this.directory || dirname(path) !== await this.directory) {
      throw new Error("Cannot seal a file outside live export storage");
    }
    signal?.throwIfAborted();
    const hash = createHash("sha256");
    let byteLength = known?.byteLength ?? 0;
    if (!known) {
      const reader = this.read(path, signal);
      try {
        for await (const chunk of reader) {
          signal?.throwIfAborted();
          hash.update(chunk);
          byteLength += chunk.length;
        }
      } finally { reader.destroy(); }
    }
    signal?.throwIfAborted();
    if (known && ((await stat(path)).size !== known.byteLength || !/^[0-9a-f]{64}$/.test(known.sha256))) throw new TypeError("Invalid sealed file identity");
    await chmod(path, 0o400);
    const sha256 = known?.sha256 ?? hash.digest("hex");
    return Object.freeze({
      byteLength,
      sha256,
      open: () => {
        if (this.disposed) throw new Error("Export storage is disposed");
        return Readable.toWeb(this.read(path)) as ReadableStream<Uint8Array>;
      },
      dispose: () => this.dispose(),
    });
  }

  dispose(): Promise<void> {
    if (this.disposal) return this.disposal;
    this.disposed = true;
    this.disposal = (async () => {
      const closing = [...this.readers].map((reader) => new Promise<void>((resolve) => {
        if (reader.closed) return resolve();
        reader.once("close", resolve);
        reader.destroy();
      }));
      await Promise.all(closing);
      if (this.directory) await rm(await this.directory, { recursive: true, force: true });
    })();
    return this.disposal;
  }

  private read(path: string, signal?: AbortSignal): ReadStream {
    const stream = createReadStream(path, {
      highWaterMark: 1024 * 1024,
      ...(signal === undefined ? {} : { signal }),
    });
    this.readers.add(stream);
    stream.once("close", () => this.readers.delete(stream));
    return stream;
  }
}
