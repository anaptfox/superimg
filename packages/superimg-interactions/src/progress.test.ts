import { describe, expect, it, vi } from "vitest";
import {
  MEDIA_INTERACTION_IDS,
  MediaInteractionProgressError,
  createMediaInteractionProgressReporter,
  type MediaInteractionProgressRecord,
} from "./index.js";

const TARGET = Object.freeze({
  programDigest: `sha256:${"a".repeat(64)}`,
  interactionId: MEDIA_INTERACTION_IDS.export,
  contractDigest: `sha256:${"b".repeat(64)}`,
});

function recordingReporter(records: MediaInteractionProgressRecord[]) {
  return createMediaInteractionProgressReporter(
    {
      executionId: "export:launch",
      observer: { append: (record) => { records.push(record); } },
    },
    TARGET,
  );
}

describe("media interaction progress reporter", () => {
  it("emits exact ordered records with monotonic work and elapsed time", async () => {
    const records: MediaInteractionProgressRecord[] = [];
    const progress = recordingReporter(records);

    await progress.report({ subject: { kind: "interaction" }, state: "started" });
    await progress.report({
      subject: { kind: "stage", stageId: "runtime.render" },
      state: "started",
      work: { unit: "renditions", completed: 0 },
    });
    await progress.report({
      subject: { kind: "stage", stageId: "runtime.render" },
      state: "running",
      work: { unit: "renditions", completed: 1, total: 2 },
    });
    const completed = await progress.report({
      subject: { kind: "stage", stageId: "runtime.render" },
      state: "succeeded",
      work: { unit: "renditions", completed: 2 },
    });
    await progress.report({ subject: { kind: "interaction" }, state: "succeeded" });

    expect(records.map(({ sequence }) => sequence)).toEqual([0, 1, 2, 3, 4]);
    expect(records.map(({ elapsedMs }) => elapsedMs)).toEqual(
      [...records.map(({ elapsedMs }) => elapsedMs)].sort((a, b) => a - b),
    );
    expect(completed.work).toEqual({ unit: "renditions", completed: 2, total: 2 });
    expect(Object.isFrozen(completed)).toBe(true);
    expect(Object.isFrozen(completed.interaction)).toBe(true);
    expect(Object.isFrozen(completed.subject)).toBe(true);
    expect(Object.isFrozen(completed.work)).toBe(true);
  });

  it("omits unknown totals instead of inventing zero or a percentage", async () => {
    const records: MediaInteractionProgressRecord[] = [];
    const progress = recordingReporter(records);
    await progress.report({ subject: { kind: "interaction" }, state: "started" });
    const record = await progress.report({
      subject: { kind: "stage", stageId: "collection.snapshot" },
      state: "started",
      work: { unit: "items", completed: 0 },
    });

    expect(record.work).toEqual({ unit: "items", completed: 0 });
    expect(record.work).not.toHaveProperty("total");
    expect(record).not.toHaveProperty("percentage");
  });

  it("rejects work regression, changed totals, and post-terminal updates", async () => {
    const progress = recordingReporter([]);
    await progress.report({ subject: { kind: "interaction" }, state: "started" });
    await progress.report({
      subject: { kind: "stage", stageId: "runtime.render" },
      state: "started",
      work: { unit: "frames", completed: 1, total: 3 },
    });

    expect(() => progress.report({
      subject: { kind: "stage", stageId: "runtime.render" },
      state: "running",
      work: { unit: "frames", completed: 0, total: 3 },
    })).toThrowError(MediaInteractionProgressError);
    expect(() => progress.report({
      subject: { kind: "stage", stageId: "runtime.render" },
      state: "running",
      work: { unit: "frames", completed: 2, total: 4 },
    })).toThrowError(MediaInteractionProgressError);

    await progress.report({
      subject: { kind: "stage", stageId: "runtime.render" },
      state: "failed",
      error: { code: "ENCODE_FAILED", path: "runtime.render", message: "encode failed" },
    });
    expect(() => progress.report({
      subject: { kind: "stage", stageId: "runtime.render" },
      state: "running",
    })).toThrowError(MediaInteractionProgressError);
  });

  it("requires descendants to terminate before their stage and interaction", async () => {
    const records: MediaInteractionProgressRecord[] = [];
    const progress = recordingReporter(records);
    const stage = { kind: "stage" as const, stageId: "runtime.render" };
    const item = {
      kind: "item" as const,
      stageId: "runtime.render",
      item: { itemId: "rendition:one", kind: "rendition" as const },
    };
    const failure = {
      code: "RENDER_FAILED",
      path: "runtime.render",
      message: "render failed",
    };

    await progress.report({ subject: { kind: "interaction" }, state: "started" });
    await progress.report({ subject: stage, state: "started" });
    await progress.report({ subject: item, state: "started" });

    expect(() => progress.report({
      subject: stage,
      state: "failed",
      error: failure,
    })).toThrowError(MediaInteractionProgressError);
    expect(() => progress.report({
      subject: { kind: "interaction" },
      state: "failed",
      error: failure,
    })).toThrowError(MediaInteractionProgressError);

    await progress.report({ subject: item, state: "failed", error: failure });
    await progress.report({ subject: stage, state: "failed", error: failure });
    await progress.report({
      subject: { kind: "interaction" },
      state: "failed",
      error: failure,
    });
    expect(records.map(({ sequence }) => sequence)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("keeps rejected updates atomic so a corrected retry has no sequence gap", async () => {
    const records: MediaInteractionProgressRecord[] = [];
    const progress = recordingReporter(records);
    const stage = { kind: "stage" as const, stageId: "runtime.render" };

    await progress.report({ subject: { kind: "interaction" }, state: "started" });
    await progress.report({
      subject: stage,
      state: "started",
      work: { unit: "frames", completed: 0, total: 2 },
    });

    expect(() => progress.report({
      subject: stage,
      state: "failed",
      work: { unit: "frames", completed: 1, total: 2 },
      error: { code: "RENDER_FAILED", path: "runtime.render", message: "" },
    })).toThrowError(MediaInteractionProgressError);
    expect(() => progress.report({
      subject: stage,
      state: "cancelled",
      work: { unit: "frames", completed: 1, total: 2 },
      reason: "",
    })).toThrowError(MediaInteractionProgressError);
    expect(() => progress.report({
      subject: stage,
      state: "running",
      work: { unit: "frames", completed: 1, total: 3 },
    })).toThrowError(MediaInteractionProgressError);

    const corrected = await progress.report({
      subject: stage,
      state: "running",
      work: { unit: "frames", completed: 0, total: 2 },
    });
    expect(corrected).toMatchObject({ sequence: 2, state: "running" });
    expect(records.map(({ sequence }) => sequence)).toEqual([0, 1, 2]);
  });

  it("keeps colon and prefix-related stage and item identities distinct", async () => {
    const records: MediaInteractionProgressRecord[] = [];
    const progress = recordingReporter(records);
    const parentStage = { kind: "stage" as const, stageId: "render" };
    const prefixedStage = { kind: "stage" as const, stageId: "render:child" };
    const colonItem = {
      kind: "item" as const,
      stageId: "render",
      item: { itemId: "child:rendition", kind: "rendition" as const },
    };
    const nestedItem = {
      kind: "item" as const,
      stageId: "render:child",
      item: { itemId: "rendition", kind: "rendition" as const },
    };

    await progress.report({ subject: { kind: "interaction" }, state: "started" });
    await progress.report({
      subject: parentStage,
      state: "started",
      work: { unit: "frames", completed: 1, total: 1 },
    });
    await progress.report({
      subject: prefixedStage,
      state: "started",
      work: { unit: "frames", completed: 0, total: 1 },
    });
    await progress.report({ subject: colonItem, state: "started" });
    await progress.report({ subject: nestedItem, state: "started" });
    await progress.report({ subject: colonItem, state: "succeeded" });
    await progress.report({ subject: nestedItem, state: "succeeded" });
    await progress.report({ subject: parentStage, state: "succeeded" });
    await progress.report({
      subject: prefixedStage,
      state: "running",
      work: { unit: "frames", completed: 1, total: 1 },
    });
    await progress.report({ subject: prefixedStage, state: "succeeded" });
    await progress.report({ subject: { kind: "interaction" }, state: "succeeded" });

    expect(records.map(({ sequence }) => sequence)).toEqual(
      Array.from({ length: records.length }, (_, index) => index),
    );
    expect(records.filter(({ subject }) => subject.kind === "item")).toHaveLength(4);
  });

  it("preserves partial-item failure ordering", async () => {
    const records: MediaInteractionProgressRecord[] = [];
    const progress = recordingReporter(records);
    const stage = { kind: "stage" as const, stageId: "runtime.render" };
    const first = {
      kind: "item" as const,
      stageId: "runtime.render",
      item: { itemId: "entry:first", kind: "entry" as const, entryId: "first" },
    };
    const second = {
      kind: "item" as const,
      stageId: "runtime.render",
      item: { itemId: "entry:second", kind: "entry" as const, entryId: "second" },
    };

    await progress.report({ subject: { kind: "interaction" }, state: "started" });
    await progress.report({ subject: stage, state: "started" });
    await progress.report({ subject: first, state: "started" });
    await progress.report({ subject: first, state: "succeeded" });
    await progress.report({ subject: second, state: "started" });
    await progress.report({
      subject: second,
      state: "failed",
      error: { code: "RENDER_FAILED", path: "runtime.render", message: "failed" },
    });
    await progress.report({
      subject: stage,
      state: "failed",
      error: { code: "RENDER_FAILED", path: "runtime.render", message: "failed" },
    });
    await progress.report({
      subject: { kind: "interaction" },
      state: "failed",
      error: { code: "INTERACTION_FAILED", path: "media.export", message: "failed" },
    });

    expect(records.map(({ subject, state }) => [
      subject.kind === "item" ? subject.item.itemId : subject.kind,
      state,
    ])).toEqual([
      ["interaction", "started"],
      ["stage", "started"],
      ["entry:first", "started"],
      ["entry:first", "succeeded"],
      ["entry:second", "started"],
      ["entry:second", "failed"],
      ["stage", "failed"],
      ["interaction", "failed"],
    ]);
  });

  it("isolates observer failures from reporting and later records", async () => {
    const append = vi.fn(() => {
      throw new Error("viewer disconnected");
    });
    const progress = createMediaInteractionProgressReporter(
      { executionId: "export:launch", observer: { append } },
      TARGET,
    );

    await expect(progress.report({
      subject: { kind: "interaction" },
      state: "started",
    })).resolves.toMatchObject({ sequence: 0, state: "started" });
    await expect(progress.report({
      subject: { kind: "interaction" },
      state: "cancelled",
      reason: "cancelled by host",
    })).resolves.toMatchObject({ sequence: 1, state: "cancelled" });
    expect(append).toHaveBeenCalledTimes(2);
  });

  it("continues sequence and elapsed time from a durable resume point", async () => {
    const records: MediaInteractionProgressRecord[] = [];
    const progress = createMediaInteractionProgressReporter(
      {
        executionId: "export:launch",
        observer: { append: (record) => { records.push(record); } },
        resume: { sequence: 8, elapsedMs: 250 },
      },
      TARGET,
    );

    await progress.report({ subject: { kind: "interaction" }, state: "running" });
    expect(records[0]).toMatchObject({ sequence: 9, state: "running" });
    expect(records[0]!.elapsedMs).toBeGreaterThanOrEqual(250);
  });
});
