import { describe, expect, it, vi } from "vitest";
import { Buffer } from "node:buffer";
import type { RuntimeArtifactBacking } from "./adapter.js";
import { readByteStream } from "./bytes.js";
import { createConversionArtifact } from "./conversion.js";
import { sha256Hex } from "../ir/pure/sha256.js";

const tracks = [{ sourceId: "source", trackId: "video", action: "copy" as const }];
const common = { mimeType: "video/mp4", durationSeconds: 1, tracks };

function sealed(bytes: Uint8Array) {
  const cancel = vi.fn(async () => {});
  const dispose = vi.fn(async () => {});
  const backing: RuntimeArtifactBacking = {
    byteLength: bytes.byteLength,
    sha256: sha256Hex(bytes),
    open: vi.fn(() => new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(bytes.slice()); },
      cancel,
    })),
    dispose,
  };
  return { backing, cancel, dispose };
}

describe("conversion artifact ownership", () => {
  it("owns a Buffer view without aliasing caller or returned chunks", async () => {
    const caller = Buffer.from([99, 1, 2, 3, 98]);
    const artifact = createConversionArtifact({ ...common, bytes: caller.subarray(1, 4) });
    caller[1] = 7;
    const reader = artifact.open().getReader();
    const chunk = (await reader.read()).value!;
    expect(chunk).toEqual(new Uint8Array([1, 2, 3]));
    chunk.fill(8);
    expect(await readByteStream(artifact.open())).toEqual(new Uint8Array([1, 2, 3]));
    expect(artifact.byteLength).toBe(3);
    expect(artifact.sha256).toBe(sha256Hex(new Uint8Array([1, 2, 3])));
    await artifact.dispose();
    expect([...caller]).toEqual([99, 7, 2, 3, 98]);
  });

  it("owns byte input and isolates repeated reads from mutations", async () => {
    const input = new Uint8Array([1, 2, 3]);
    const artifact = createConversionArtifact({ ...common, bytes: input });
    input.fill(9);
    const first = await readByteStream(artifact.open());
    first.fill(8);
    expect(await readByteStream(artifact.open())).toEqual(new Uint8Array([1, 2, 3]));
    expect(artifact.sha256).toBe(sha256Hex(new Uint8Array([1, 2, 3])));
    await artifact.dispose();
    expect(() => artifact.open()).toThrow(/disposed/);
  });

  it("invalidates a byte reader that was opened before disposal", async () => {
    const artifact = createConversionArtifact({ ...common, bytes: new Uint8Array([1, 2]) });
    const reader = artifact.open().getReader();
    await Promise.all([artifact.dispose(), artifact.dispose(), artifact[Symbol.asyncDispose]()]);
    await expect(reader.read()).rejects.toThrow(/disposed/);
    expect(() => artifact.open()).toThrow(/disposed/);
  });

  it("adopts sealed backing without reading, cancels active readers and disposes once", async () => {
    const f = sealed(new Uint8Array([1, 2, 3]));
    const artifact = createConversionArtifact({ ...common, backing: f.backing });
    expect(f.backing.open).not.toHaveBeenCalled();
    const reader1 = artifact.open().getReader();
    const reader2 = artifact.open().getReader();
    expect((await reader1.read()).value).toEqual(new Uint8Array([1, 2, 3]));
    expect((await reader2.read()).value).toEqual(new Uint8Array([1, 2, 3]));
    await Promise.all([artifact.dispose(), artifact.dispose()]);
    await expect(reader1.read()).rejects.toThrow(/disposed/);
    await expect(reader2.read()).rejects.toThrow(/disposed/);
    expect(f.cancel).toHaveBeenCalledTimes(2);
    expect(f.dispose).toHaveBeenCalledOnce();
    expect(() => artifact.open()).toThrow(/disposed/);
  });

  it("leaves an invalid, unadopted backing with the caller", () => {
    const f = sealed(new Uint8Array([1]));
    expect(() => createConversionArtifact({ ...common, durationSeconds: 0, backing: f.backing })).toThrow(/duration/);
    expect(f.dispose).not.toHaveBeenCalled();
    expect(() => createConversionArtifact({ ...common, backing: { ...f.backing, sha256: "invalid" } })).toThrow(/backing/);
    expect(f.dispose).not.toHaveBeenCalled();
  });

  it("attempts backing cleanup even when reader cancellation fails", async () => {
    const f = sealed(new Uint8Array([1]));
    f.cancel.mockRejectedValueOnce(new Error("reader cleanup failed"));
    const artifact = createConversionArtifact({ ...common, backing: f.backing });
    const reader = artifact.open().getReader();
    await expect(artifact.dispose()).rejects.toThrow(/dispose conversion/);
    await expect(reader.read()).rejects.toThrow(/disposed/);
    expect(f.dispose).toHaveBeenCalledOnce();
    await expect(artifact.dispose()).rejects.toThrow(/dispose conversion/);
  });
});
