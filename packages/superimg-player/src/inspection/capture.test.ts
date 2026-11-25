import { describe, expect, it } from "vitest";
import { captureAccepted, captureFreshness, type CaptureSnapshot } from "./capture.js";

const snapshot = (): CaptureSnapshot => ({ surfaceId: "media", generation: 1, requestedFrame: 6, presented: { frame: 6, revision: 2 }, readiness: { status: "ready" }, clock: { owner: "inspection" }, source: { id: "scene", revision: "old" }, width: 320, height: 180, fps: 25 });

describe("portable capture acceptance", () => {
  it("detaches facts and retains a consistent stale capture after a failed compilation", async () => {
    const value = { ...snapshot(), compilation: { status: "failed" as const, error: { code: "COMPILE_ERROR", message: "bad edit" } } };
    let count = 0;
    const result = await captureAccepted({ inspect: async () => value, identity: async () => ({ target: "one" }), capture: async () => { count++; } }, { expectedFrame: 6 });
    value.source = { id: "scene", revision: "later" };
    expect(result).toMatchObject({ status: "accepted", freshness: { status: "stale", reason: "compilation-failed" }, before: { source: { revision: "old" } }, after: { source: { revision: "old" } } });
    expect(count).toBe(1);
  });

  it("checks explicit expected source without conflating it with consistency", async () => {
    const result = await captureAccepted({ inspect: async () => snapshot(), identity: async () => "page", capture: async () => {} }, { expectedSource: { id: "scene", revision: "new" } });
    expect(result).toMatchObject({ status: "rejected", freshness: { status: "stale" }, issues: ["expected-source-not-presented"] });
    expect(captureFreshness(snapshot()).status).toBe("unknown");
    expect(captureFreshness({ ...snapshot(), compilation: { status: "succeeded", source: { id: "scene", revision: "old" } } }).status).toBe("matched");
  });

  it("rejects a revision change around exactly one capture", async () => {
    let value = snapshot(); let captures = 0;
    const report = await captureAccepted({ inspect: async () => value, identity: async () => "page", capture: async () => { captures++; value = { ...value, presented: { frame: 6, revision: 3 } }; } });
    expect(report.issues).toContain("presented-changed");
    expect(report.before?.presented?.revision).toBe(2);
    expect(captures).toBe(1);
  });

  it("preserves structured uncertainty and cancels without recapturing", async () => {
    let captures = 0;
    const report = await captureAccepted({ inspect: async () => snapshot(), identity: async () => "page", capture: async () => { captures++; throw Object.assign(new Error("response lost"), { code: "COMMAND_UNCERTAIN" }); } });
    expect(report).toMatchObject({ status: "rejected", error: { code: "COMMAND_UNCERTAIN" } });
    const controller = new AbortController(); controller.abort();
    const cancelled = await captureAccepted({ inspect: async () => snapshot(), identity: async () => "page", capture: async () => { captures++; } }, { signal: controller.signal });
    expect(cancelled.error?.code).toBe("CAPTURE_ABORTED");
    expect(captures).toBe(1);
  });
});
