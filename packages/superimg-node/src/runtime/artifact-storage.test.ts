import { writeFile, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { allocateMediaTarget, ExportArtifactStorage } from "./artifact-storage.js";
import * as media from "mediabunny";

describe("export artifact file ownership", () => {
  it("enforces the output byte limit while a real muxer writes to a file", async () => {
    const { storage, path, target } = await allocateMediaTarget(media, "mkv", 32);
    const output = new media.Output({ format: new media.MkvOutputFormat(), target });
    const source = new media.EncodedAudioPacketSource("pcm-f32"); output.addAudioTrack(source);
    try {
      await expect((async () => {
        await output.start();
        await source.add(new media.EncodedPacket(new Uint8Array(2048), "key", 0, 0.064), { decoderConfig: { codec: "pcm-f32", sampleRate: 8000, numberOfChannels: 1 } });
        await output.finalize();
      })()).rejects.toThrow("byte limit");
    } finally { await output.cancel().catch(() => {}); await storage.dispose(); }
    await expect(stat(path)).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("seals and hashes chunked storage, allows repeat reads, and removes private files on disposal", async () => {
    const storage = new ExportArtifactStorage();
    const path = await storage.allocate("mp4");
    const bytes = Buffer.alloc(3 * 1024 * 1024 + 27, 0x7e);
    await writeFile(path, bytes);
    const backing = await storage.seal(path);
    expect(backing.byteLength).toBe(bytes.length);
    expect(backing.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    for (let i=0;i<2;i++) {
      const reader = backing.open().getReader();
      let count=0;
      for (;;) { const next=await reader.read(); if(next.done) break; expect(next.value.length).toBeLessThanOrEqual(1024*1024); count+=next.value.length; }
      reader.releaseLock();
      expect(count).toBe(bytes.length);
    }
    await Promise.all([backing.dispose(), storage.dispose()]);
    await expect(stat(dirname(path))).rejects.toMatchObject({ code: "ENOENT" });
    expect(() => backing.open()).toThrow(/disposed/);
  });

  it("closes active readers and cleans up a cancelled or incomplete job", async () => {
    const storage = new ExportArtifactStorage();
    const path = await storage.allocate("mov");
    await writeFile(path, Buffer.alloc(2 * 1024 * 1024));
    const backing = await storage.seal(path);
    const reader = backing.open().getReader();
    await reader.read();
    await storage.dispose();
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
    await expect(stat(path)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("never adopts a caller's unrelated path", async () => {
    const storage = new ExportArtifactStorage();
    await expect(storage.seal("/unowned/movie.mp4")).rejects.toThrow(/outside live export storage/);
    await storage.dispose();
  });
});
