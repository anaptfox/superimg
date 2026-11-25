/** @vitest-environment happy-dom */
import { expect, it } from "vitest";
import { video } from "@superimg/types";
import { Frame, Text } from "@superimg/stdlib/tree";
import { sequence, time } from "@superimg/core/composition";
import { createDomPlayer } from "../dom-player.js";
import { createPreviewInspection } from "./index.js";

it("holds the last authored frame and rejects frames outside the inspection clock", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const player = createDomPlayer({ container: host });
  await player.load(time(sequence([{ id: "seven", content: video({ size: { width: 320, height: 180 }, fps: 25, duration: "7f",
    render: (ctx) => Frame({ width: "fill", height: "fill" }, Text(`frame:${ctx.timeline.frame}`)),
  }) }]), { size: { width: 320, height: 180 }, fps: 25 }));
  const inspection = createPreviewInspection({ readinessTimeoutMs: 500 });
  inspection.attach({ surfaceId: "film", player, controls: ["set-mode", "seek-frame"] });
  try {
    const initial = await inspection.inspect({ surfaceId: "film" });
    await inspection.setMode({ surfaceId: "film", mode: "inspection", expectedGeneration: initial.generation });
    const shown = await inspection.seek({ surfaceId: "film", frame: 6, expectedGeneration: initial.generation });
    expect(shown).toMatchObject({ schemaVersion: 1, totalFrames: 7, fps: 25, presented: { frame: 6 }, clock: { owner: "inspection" } });
    expect(host.querySelector("iframe")?.contentDocument?.body.textContent).toContain("frame:6");
    await expect(inspection.seek({ surfaceId: "film", frame: 7, expectedGeneration: initial.generation })).rejects.toMatchObject({ code: "FRAME_OUT_OF_RANGE" });
    expect(player.getState().currentFrame).toBe(6);
  } finally { inspection.dispose(); player.dispose(); host.remove(); }
});
