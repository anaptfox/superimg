import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveMediaIR } from "@superimg/core";
import { image, MEDIA_ELEMENT } from "@superimg/types";
import { describe, expect, it } from "vitest";
import { createBaselineStore } from "./baseline.js";

describe("baseline store", () => {
  it("saves validated IR with metadata, rejects collisions and detects partial pairs", async () => {
    const root = await mkdtemp(join(tmpdir(), "baseline-store-"));
    try {
      const { ir } = await resolveMediaIR(image({ size: { width: 32, height: 32 }, render: () => ({ $$typeof: MEDIA_ELEMENT, type: "Html", props: { width: "fill", height: "fill", html: "hello" }, children: [] }) as never }), { sourceId: "card" });
      const store = createBaselineStore(root);
      expect(await store.read("card")).toBeNull();
      const saved = await store.save({ sourceId: "card", sourcePath: "/first/card.media.ts", media: ir, savedAt: "2026-01-01T00:00:00Z" });
      expect((await store.read("card"))?.meta).toEqual(saved.meta);
      expect(await store.list()).toEqual([saved.meta]);
      await expect(store.save({ sourceId: "card", sourcePath: "/other/card.media.ts", media: ir })).rejects.toThrow("BASELINE_COLLISION");
      await mkdir(join(root, ".card.lock"));
      await expect(store.clear("card")).rejects.toThrow("BASELINE_LOCKED");
      await expect(store.save({ sourceId: "card", sourcePath: "/first/card.media.ts", media: ir })).rejects.toThrow("BASELINE_LOCKED");
      expect((await store.read("card"))?.meta).toEqual(saved.meta);
      await rm(join(root, ".card.lock"), { recursive: true });
      await writeFile(join(root, "card", "meta.json"), JSON.stringify({ ...saved.meta, intentHash: "wrong" }));
      await expect(store.read("card")).rejects.toThrow("BASELINE_MISMATCH");
      await store.clear("card");
      await store.save({ sourceId: "card", sourcePath: "/first/card.media.ts", media: ir });
      await rm(join(root, "card", "media.json"));
      await expect(store.read("card")).rejects.toThrow("BASELINE_INCOMPLETE");
      await store.clear("card");
      await expect(store.save({ sourceId: "bad", sourcePath: "/bad", media: {} as never })).rejects.toThrow();
      expect(await store.list()).toEqual([]);
      await expect(store.save({ sourceId: "../escape", sourcePath: "/x", media: ir })).rejects.toThrow("Invalid baseline");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
