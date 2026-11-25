import { describe, expect, it } from "vitest";
import { createMemoryTakeStore } from "./memory-store.js";
import type { TakeRecordV2 } from "./types.js";

function makeTake(overrides: Partial<TakeRecordV2> & { id: string }): TakeRecordV2 {
  return {
    schemaVersion: 2,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    mediaFile: "story.media.ts",
    good: [],
    bad: [],
    feedback: [],
    files: [],
    renditions: [],
    ...overrides,
  };
}

describe("createMemoryTakeStore", () => {
  it("stores, filters, clones, and searches takes and blobs in memory", async () => {
    const store = createMemoryTakeStore();
    await store.put(
      makeTake({
        id: "t1",
        tenantId: "lantern",
        storyId: "ep1",
        createdAt: "2026-01-01T00:00:00.000Z",
        renditions: [{ sha256: "abc123", path: "ep1.mp4" }],
      }),
    );
    await store.put(
      makeTake({
        id: "t2",
        tenantId: "lantern",
        storyId: "ep2",
        createdAt: "2026-01-02T00:00:00.000Z",
        renditions: [{ sha256: "def456", path: "ep2.mp4" }],
      }),
    );

    const all = await store.list({ tenantId: "lantern" });
    expect(all.map((t) => t.id)).toEqual(["t2", "t1"]);

    const ep1 = await store.list({ tenantId: "lantern", storyId: "ep1" });
    expect(ep1.map((t) => t.id)).toEqual(["t1"]);

    const byRendition = await store.findByRendition("abc123");
    expect(byRendition.map((t) => t.id)).toEqual(["t1"]);

    const updated = await store.addFeedback("t1", {
      kind: "good",
      text: "Great opening beat",
      cueId: "shot-1",
      atSeconds: 1.5,
    });
    expect(updated.good).toEqual(["Great opening beat"]);
    expect(updated.feedback).toHaveLength(1);

    const payload = new Uint8Array([1, 2, 3, 4]);
    await store.putBlob("abc123", payload, "video/mp4");
    payload[0] = 99;
    const loaded = await store.getBlob("abc123");
    expect(loaded).toEqual(new Uint8Array([1, 2, 3, 4]));
  });
});
