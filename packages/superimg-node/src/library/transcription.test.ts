import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";
import { transcribe } from "./transcription.js";
const bytes = new Uint8Array([1, 2, 3]);
const inspection = { schemaVersion: 0 as const, kind: "@foxworth/superimg/media-inspection" as const, mimeType: "audio/wav", byteLength: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), tracks: [{ id: "voice", kind: "audio" as const, durationSeconds: 5 }] };
it("validates the selected exact bytes and invokes one host adapter", async () => {
  const adapter = vi.fn(async ({ source }: { source: { mediaSha256: string; trackId: string; durationSeconds: number } }) => ({ schemaVersion: 1 as const, source, revision: "r1", timeUnit: "seconds" as const, spans: [{ id: "a", text: "hello", granularity: "word" as const, alignment: "recognized" as const, timing: { startSeconds: 1, endSeconds: 2 } }] }));
  const result = await transcribe({ bytes, inspection, trackId: "voice" }, adapter);
  expect(result.spans[0]!.text).toBe("hello"); expect(adapter).toHaveBeenCalledTimes(1);
  await expect(transcribe({ bytes: new Uint8Array([9]), inspection, trackId: "voice" }, adapter)).rejects.toThrow("does not match");
  await expect(transcribe({ bytes, inspection, trackId: "missing" }, adapter)).rejects.toThrow("audio track");
  await expect(transcribe({ bytes, inspection, trackId: "voice" }, async ({ source }) => ({ schemaVersion: 1, source: { ...source, trackId: "other" }, revision: "x", timeUnit: "seconds", spans: [] }))).rejects.toThrow("does not match selection");
  await expect(transcribe({ bytes, inspection, trackId: "voice" }, adapter, { signal: AbortSignal.abort() })).rejects.toMatchObject({ name: "AbortError" });
  expect(adapter).toHaveBeenCalledTimes(1);
});

it("propagates adapter failure and abort after dispatch without retry", async () => {
  const failed = vi.fn(async () => { throw new Error("provider failed"); });
  await expect(transcribe({ bytes, inspection, trackId: "voice" }, failed)).rejects.toThrow("provider failed");
  expect(failed).toHaveBeenCalledTimes(1);
  const controller = new AbortController();
  const adapter = vi.fn(async ({ source }: { source: { mediaSha256: string; trackId: string; durationSeconds: number } }) => {
    controller.abort(); return { schemaVersion: 1 as const, source, revision: "r", timeUnit: "seconds" as const, spans: [] };
  });
  await expect(transcribe({ bytes, inspection, trackId: "voice" }, adapter, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  expect(adapter).toHaveBeenCalledTimes(1);
});
