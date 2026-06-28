/** @vitest-environment happy-dom */

import { describe, expect, it } from "vitest";
import { define } from "@superimg/types";
import { Player, type PlayerInput } from "./player.js";

describe("Player vNext runtime-web integration", () => {
  it("loads, seeks, updates, and disposes through runtime-web", async () => {
    const container = document.createElement("div");
    const template = define({
      sample: { label: "initial" },
      config: { width: 320, height: 180, fps: 10, duration: 1 },
      render: (ctx) => `<div>${ctx.globalFrame}:${ctx.data.label}</div>`,
    });
    const player = new Player({ container });

    const result = await player.load(template as unknown as PlayerInput);

    expect(result.status).toBe("success");
    expect(player.getState().totalFrames).toBe(10);

    player.seekFrame(999);
    expect(player.currentFrame).toBe(9);

    player.update({ data: { label: "updated" } });
    expect(player.getState().currentFrame).toBe(9);

    player.dispose();
    expect(container.children.length).toBe(0);
  });

  it("does not expose removed legacy aliases", () => {
    const player = new Player({ container: document.createElement("div") });
    const exposed = player as unknown as Record<string, unknown>;

    expect(exposed.seekToFrame).toBeUndefined();
    expect(exposed.seekToProgress).toBeUndefined();
    expect(exposed.setData).toBeUndefined();
    expect(exposed.setFormat).toBeUndefined();
    expect(exposed.captureFrame).toBeUndefined();
    expect(exposed.destroy).toBeUndefined();
  });
});
