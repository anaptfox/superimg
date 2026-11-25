import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import type { MediaInput, MediaInspection } from "@superimg/types";
import { ExportArtifactStorage } from "./artifact-storage.js";
import type { LoadedInput } from "./media.js";

/** Maximum input bytes accepted by default, including streamed URL bodies. */
export const DEFAULT_MEDIA_INPUT_BYTES = 512 * 1024 * 1024;
export interface PreparedMediaInput extends AsyncDisposable {
  readonly byteLength: number;
  readonly sha256: string;
  inspect(): Promise<MediaInspection>;
  dispose(): Promise<void>;
}
export type NodeMediaInput = MediaInput | PreparedMediaInput;

type State = { path: string; storage: ExportArtifactStorage; byteLength: number; sha256: string; active: number; closed: boolean; disposal?: Promise<void>; idle?: () => void; inspection?: Promise<MediaInspection> };
const states = new WeakMap<PreparedMediaInput, State>();
export function isPreparedMediaInput(input: NodeMediaInput): input is PreparedMediaInput { return states.has(input as PreparedMediaInput); }

/** Internal lease. The public handle never exposes the underlying file or decoder. */
export async function acquirePreparedMediaInput(handle: PreparedMediaInput, cached = true): Promise<LoadedInput> {
  const state = states.get(handle);
  if (!state || state.closed) throw new Error("Prepared media input is disposed");
  state.active++;
  try {
    const media = await import("mediabunny");
    const input = new media.Input({ source: new media.FilePathSource(state.path), formats: media.ALL_FORMATS });
    let released = false;
    return { input, byteLength: state.byteLength, sha256: state.sha256, ...(cached && state.inspection ? { inspection: () => state.inspection! } : {}), release: async () => {
      if (released) return;
      released = true;
      try { input.dispose(); } finally { if (--state.active === 0) state.idle?.(); }
    } };
  } catch (error) { if (--state.active === 0) state.idle?.(); throw error; }
}

function makeHandle(path: string, storage: ExportArtifactStorage, byteLength: number, sha256: string): PreparedMediaInput {
  const state: State = { path, storage, byteLength, sha256, active: 0, closed: false };
  const inspect = async (): Promise<MediaInspection> => {
    if (state.closed) throw new Error("Prepared media input is disposed");
    state.inspection ??= (async () => {
      const loaded = await acquirePreparedMediaInput(handle, false);
      try { const { inspectLoadedMedia } = await import("./media.js"); return await inspectLoadedMedia(loaded); }
      finally { await loaded.release(); }
    })();
    return state.inspection;
  };
  const dispose = (): Promise<void> => {
    if (state.disposal) return state.disposal;
    state.closed = true;
    state.disposal = (async () => {
      if (state.active > 0) await new Promise<void>(resolve => { state.idle = resolve; });
      await storage.dispose();
    })();
    return state.disposal;
  };
  const handle = Object.freeze({ byteLength, sha256, inspect, dispose, [Symbol.asyncDispose]: dispose });
  states.set(handle, state);
  return handle;
}

/** Ingest once, hash the immutable snapshot while writing, and retain it until disposal. */
export async function prepareMediaInput(input: MediaInput, options: { maxInputBytes?: number; signal?: AbortSignal; fetch?: typeof fetch } = {}): Promise<PreparedMediaInput> {
  const limit = options.maxInputBytes ?? DEFAULT_MEDIA_INPUT_BYTES;
  if (!Number.isSafeInteger(limit) || limit < 1) throw new RangeError("Invalid media input byte limit");
  options.signal?.throwIfAborted();
  if (input.kind === "bytes" && input.bytes.byteLength > limit) throw new RangeError("Media input exceeds byte limit");
  // Snapshot caller-owned bytes before the first asynchronous boundary.
  const bytes = input.kind === "bytes" ? new Uint8Array(input.bytes) : undefined;
  const storage = new ExportArtifactStorage();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let abort: (() => void) | undefined;
  try {
    const path = await storage.allocate("media");
    const file = await open(path, "wx", 0o600);
    const hash = createHash("sha256"); let length = 0;
    try {
      const write = async (chunk: Uint8Array) => {
        options.signal?.throwIfAborted();
        if (chunk.byteLength > limit - length) throw new RangeError("Media input exceeds byte limit");
        // A stream producer may reuse or mutate its chunk after enqueueing it.
        const owned = new Uint8Array(chunk);
        await file.writeFile(owned); hash.update(owned); length += owned.byteLength;
      };
      if (bytes) await write(bytes);
      else {
        const response = await (options.fetch ?? fetch)((input as Extract<MediaInput, { kind: "url" }>).url, options.signal ? { signal: options.signal } : undefined);
        if (!response.ok) { await response.body?.cancel(); throw new Error(`Failed to fetch media: ${response.status}`); }
        if (!response.body) throw new TypeError("Media response has no body");
        reader = response.body.getReader();
        const declared = response.headers.get("content-length");
        if (declared && /^\d+$/.test(declared) && BigInt(declared) > BigInt(limit)) throw new RangeError("Media input exceeds byte limit");
        abort = () => { void reader?.cancel(options.signal?.reason).catch(() => {}); };
        options.signal?.addEventListener("abort", abort, { once: true });
        for (;;) { options.signal?.throwIfAborted(); const next = await reader.read(); options.signal?.throwIfAborted(); if (next.done) break; await write(next.value); }
      }
    } finally { await file.close(); }
    options.signal?.throwIfAborted();
    const digest = hash.digest("hex");
    await storage.seal(path, options.signal, { byteLength: length, sha256: digest });
    const prepared = makeHandle(path, storage, length, digest);
    await prepared.inspect();
    options.signal?.throwIfAborted();
    return prepared;
  } catch (error) {
    await reader?.cancel(error).catch(() => {});
    await storage.dispose();
    throw error;
  } finally {
    if (abort) options.signal?.removeEventListener("abort", abort);
    reader?.releaseLock();
  }
}
