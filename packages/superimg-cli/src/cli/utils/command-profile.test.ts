import { describe, expect, it } from "vitest";
import { commandRendererTiming, profileStage, withCommandProfile, type CommandProfile } from "./command-profile.js";

describe("command-local profiling", () => {
  it("records actual nested invocations without summing inclusive spans", async () => {
    const records: unknown[] = [];
    await withCommandProfile("inspect", { profile: true }, () => profileStage("prepare", async () => {
      await profileStage("compile", async () => { commandRendererTiming({ stage: "readiness", durationMs: 1, status: "completed", clock: "local-monotonic" }); });
    }), value => records.push(value));
    const profile = (records[0] as { profile: CommandProfile }).profile;
    expect(profile.counts).toEqual({ prepare: 1, compile: 1, readiness: 1 });
    expect(profile.spans[1]?.parentId).toBe(profile.spans[0]?.id);
    expect(profile.spans[2]?.origin).toBe("renderer");
    expect(profile.wallTimeMs).toBeGreaterThanOrEqual(0);
    expect(profile.processElapsedMs).toBeGreaterThanOrEqual(profile.wallTimeMs);
  });
  it("keeps default calls uninstrumented and retains failure observations", async () => {
    const records: unknown[] = [];
    await withCommandProfile("check", {}, async () => {}, value => records.push(value));
    expect(records).toEqual([]);
    await expect(withCommandProfile("check", { profile: true }, () => profileStage("compile", async () => { throw new Error("syntax"); }), value => records.push(value))).rejects.toThrow("syntax");
    expect(records[0]).toMatchObject({ profile: { counts: { compile: 1 }, spans: [{ status: "failed" }] } });
    await expect(withCommandProfile("check", { trace: true }, async () => {})).rejects.toThrow("requires --rendered-layout");
  });
});
