import type { ConversionArtifact } from "@superimg/types";
import type { RuntimeAdapterConversionOutput, RuntimeArtifactBacking } from "./adapter.js";
import { streamOwnedBytes, verifyAndOwnBytes } from "./bytes.js";

/** Adopt a sealed backing only on success; the caller owns it if validation fails. */
export function createConversionArtifact(input: RuntimeAdapterConversionOutput): ConversionArtifact {
  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0) {
    throw new TypeError("Converted media must have a positive finite duration");
  }
  const tracks = Object.freeze(input.tracks.map((track) => Object.freeze({ ...track })));
  let backing: RuntimeArtifactBacking;
  if (input.backing !== undefined) {
    const value = input.backing;
    if (input.bytes !== undefined || !Number.isSafeInteger(value.byteLength) || value.byteLength < 0
      || !/^[a-f0-9]{64}$/.test(value.sha256)
      || typeof value.open !== "function" || typeof value.dispose !== "function") {
      throw new TypeError("Invalid sealed conversion backing");
    }
    backing = value;
  } else {
    if (input.bytes === undefined) throw new TypeError("Invalid conversion bytes");
    const owned = verifyAndOwnBytes(input.bytes);
    backing = {
      byteLength: owned.byteLength,
      sha256: owned.sha256,
      open: () => streamOwnedBytes(owned.bytes),
      async dispose() { owned.bytes.fill(0); },
    };
  }

  const active = new Set<() => Promise<void>>();
  let disposed = false;
  let disposal: Promise<void> | undefined;
  function open(): ReadableStream<Uint8Array> {
    if (disposed) throw new TypeError("Conversion artifact has been disposed");
    const reader = backing.open().getReader();
    let closed = false;
    let controller: ReadableStreamDefaultController<Uint8Array>;
    const finish = () => { closed = true; active.delete(stop); };
    const stop = async () => {
      if (closed) return;
      finish();
      controller.error(new TypeError("Conversion artifact has been disposed"));
      await reader.cancel();
    };
    const stream = new ReadableStream<Uint8Array>({
      start(value) { controller = value; active.add(stop); },
      async pull(value) {
        try {
          const result = await reader.read();
          if (closed) return;
          if (result.done) { finish(); reader.releaseLock(); value.close(); }
          else value.enqueue(result.value);
        } catch (error) {
          if (!closed) { finish(); value.error(error); }
        }
      },
      async cancel(reason) {
        if (closed) return;
        finish();
        await reader.cancel(reason);
      },
    }, { highWaterMark: 0 });
    return stream;
  }
  function dispose(): Promise<void> {
    if (disposal) return disposal;
    disposed = true;
    const readers = [...active].map((stop) => stop());
    disposal = (async () => {
      const results = await Promise.allSettled([...readers, Promise.resolve().then(() => backing.dispose())]);
      const errors = results.filter((result): result is PromiseRejectedResult => result.status === "rejected").map((result) => result.reason);
      if (errors.length) throw new AggregateError(errors, "Could not dispose conversion artifact");
    })();
    return disposal;
  }
  return Object.freeze({
    schemaVersion: 0,
    kind: "@foxworth/superimg/conversion-artifact",
    mimeType: input.mimeType,
    byteLength: backing.byteLength,
    sha256: backing.sha256,
    durationSeconds: input.durationSeconds,
    tracks,
    open,
    dispose,
    [Symbol.asyncDispose]: dispose,
  });
}
