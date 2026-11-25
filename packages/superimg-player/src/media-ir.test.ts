/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from "vitest";
import { createMediaIR, define, type MediaIR } from "@superimg/types";
import { Frame, Text } from "@superimg/stdlib/tree";
import { Player, type PlayerInput } from "./player.js";

function matchingIR(over: Partial<MediaIR> = {}): MediaIR {
  return createMediaIR({
    sourceId: "t",
    width: 320,
    height: 180,
    fps: 10,
    durationSeconds: 1,
    totalFrames: 10,
    phases: [],
    override: {
      observations: { markupRuns: [], sceneRuns: [] },
      hashes: {
        intentHash: "b".repeat(64),
        markupHash: "c".repeat(64),
        programHash: "a".repeat(64),
      },
      ...over,
    },
  });
}

function shortTemplate() {
  return define({
    config: { width: 320, height: 180, fps: 10, duration: 1 },
    render: (ctx) => Frame(
      { width: "fill", height: "fill" },
      Text({ size: 24 }, String(ctx.globalFrame)),
    ),
  });
}

describe("Player mediaIR (real entry points)", () => {
  it("load({ mediaIR }) accepts matching clock/canvas and exposes player.mediaIR", async () => {
    const container = document.createElement("div");
    const player = new Player({ container });
    const ir = matchingIR();
    const result = await player.load(shortTemplate() as unknown as PlayerInput, {
      mediaIR: ir,
    });
    expect(result.status).toBe("success");
    expect(player.mediaIR).not.toBeNull();
    expect(player.mediaIR!.hashes.intentHash).toBe(ir.hashes.intentHash);
    expect(player.mediaIR!.clock.totalFrames).toBe(10);
    player.dispose();
  });

  it("failed load keeps the last valid session (never blanks preview)", async () => {
    const container = document.createElement("div");
    const player = new Player({ container });
    const ir = matchingIR();
    const ok = await player.load(shortTemplate() as unknown as PlayerInput, {
      mediaIR: ir,
    });
    expect(ok.status).toBe("success");
    expect(player.mediaIR).not.toBeNull();
    const intentBefore = player.mediaIR!.hashes.intentHash;
    const totalBefore = player.totalFrames;

    // IR clock/canvas mismatch fails validation *before* commit — prior session stays.
    const bad = await player.load(shortTemplate() as unknown as PlayerInput, {
      mediaIR: matchingIR({ canvas: { width: 1, height: 1 } }),
    });
    expect(bad.status).toBe("error");
    expect(player.mediaIR).not.toBeNull();
    expect(player.mediaIR!.hashes.intentHash).toBe(intentBefore);
    expect(player.totalFrames).toBe(totalBefore);
    player.dispose();
  });

  it("load({ mediaIR }) rejects mismatched canvas", async () => {
    const container = document.createElement("div");
    const player = new Player({ container });
    const ir = matchingIR({ canvas: { width: 1280, height: 720 } });
    const result = await player.load(shortTemplate() as unknown as PlayerInput, {
      mediaIR: ir,
    });
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/does not match|MediaIR|IR_CLOCK/i);
    }
    expect(player.mediaIR).toBeNull();
    player.dispose();
  });

  it("setMediaIR accepts match and rejects mismatch after load", async () => {
    const container = document.createElement("div");
    const player = new Player({ container });
    await player.load(shortTemplate() as unknown as PlayerInput);
    expect(player.mediaIR).toBeNull();

    player.setMediaIR(matchingIR());
    expect(player.mediaIR?.clock.fps).toBe(10);

    expect(() =>
      player.setMediaIR(matchingIR({ clock: { fps: 24, durationSeconds: 1, totalFrames: 10 } })),
    ).toThrow(/does not match|IR_CLOCK_MISMATCH|MediaIR/i);

    player.setMediaIR(null);
    expect(player.mediaIR).toBeNull();
    player.dispose();
  });
});
