import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "../ir/pure/sha256.js";
import { readByteStream, streamOwnedBytes, verifyAndOwnBytes } from "./bytes.js";

describe("portable byte ownership", () => {
  it("copies only the Buffer view and never clears the caller on failed validation", () => {
    const caller = Buffer.from([99, 1, 2, 3, 98]);
    const view = caller.subarray(1, 4);
    const owned = verifyAndOwnBytes(view);
    expect(owned.bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(owned.byteLength).toBe(3);
    expect(owned.sha256).toBe(sha256Hex(new Uint8Array([1, 2, 3])));
    caller[1] = 7;
    expect(owned.bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(() => verifyAndOwnBytes(view, { byteLength: 4 })).toThrow(/byte length mismatch/);
    expect([...caller]).toEqual([99, 7, 2, 3, 98]);
  });

  it("snapshots Buffer views for streams and isolates returned chunks", async () => {
    const caller = Buffer.from([99, 1, 2, 3, 98]);
    const view = caller.subarray(1, 4);
    const first = streamOwnedBytes(view);
    caller[1] = 7;
    const reader = first.getReader();
    const chunk = (await reader.read()).value!;
    expect(chunk).toEqual(new Uint8Array([1, 2, 3]));
    chunk.fill(8);
    expect([...caller]).toEqual([99, 7, 2, 3, 98]);
    expect(await readByteStream(streamOwnedBytes(view))).toEqual(new Uint8Array([7, 2, 3]));
  });

  it("copies a Buffer chunk before its producer reuses the buffer", async () => {
    const caller = Buffer.from([99, 1, 2, 3, 98]);
    let first = true;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (first) { first = false; controller.enqueue(caller.subarray(1, 4)); }
        else { caller.fill(8); controller.close(); }
      },
    }, { highWaterMark: 0 });
    expect(await readByteStream(stream)).toEqual(new Uint8Array([1, 2, 3]));
  });
});
