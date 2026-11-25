//! Invariant: for any template, the IR clock and the runtime clock agree.
//!
//! The Player refuses to load a mediaIR whose {fps, totalFrames, canvas} differ
//! from the live session (IR_CLOCK_MISMATCH), so any classification drift
//! between resolveMediaIR and resolveRuntimeTemplateInfo bricks every preview
//! of the affected media definition.

import { describe, it, expect } from "vitest";
import {
  image,
  inferTemplateAnimated,
  video,
  type JsonObject,
  type MediaDefinition,
} from "@superimg/types";
import { resolveMediaIR } from "../ir/resolve-media-ir.js";
import { resolveRuntimeTemplateInfo } from "../rendering/runtime-info.js";
import { renderTemplateFrame } from "../rendering/render-frame.js";
import { sequence } from "../composition/sequence.js";
import { time } from "../composition/time.js";
import { choose } from "../composition/choose.js";
import { together } from "../composition/together.js";
import { validateMediaIR } from "../ir/pure/validate.js";
import { boxedHtml } from "./__test-utils__/index.js";

const render = () => boxedHtml("<div />");

const SHAPES: Array<{ name: string; template: MediaDefinition<JsonObject> }> = [
  {
    name: "video helper",
    template: video<JsonObject>({
      size: { width: 640, height: 360 },
      fps: 10,
      duration: 1,
      render,
    }),
  },
  {
    name: "image helper",
    template: image<JsonObject>({
      size: { width: 1200, height: 630 },
      render,
    }),
  },
  {
    name: "duration string shorthand",
    template: video<JsonObject>({
      size: { width: 640, height: 360 },
      fps: 30,
      duration: "2s",
      render,
    }),
  },
];

describe("IR clock === runtime clock", () => {
  it("keeps the exact seven-frame retained clock through rendering and IR", async () => {
    const film = time(sequence([{ id: "clip", content: video({
      size: { width: 320, height: 180 }, fps: 25, duration: "7f",
      render: (ctx) => boxedHtml(`<p>frame${ctx.timeline.frame}</p>`),
    }) }]), { size: { width: 320, height: 180 }, fps: 25 });
    const last = renderTemplateFrame({ template: film, progress: 1 });
    expect(last.frame).toBe(6);
    expect(last.ctx.totalFrames).toBe(7);
    expect(last.html).toContain("frame6");
    const { ir } = await resolveMediaIR(film);
    expect(ir.clock).toEqual({ fps: 25, totalFrames: 7, durationSeconds: 0.28 });
    for (const clock of [
      { fps: 25, totalFrames: 8, durationSeconds: 0.28 },
      { fps: 30, totalFrames: 7, durationSeconds: 7 / 30 },
      { fps: 25, totalFrames: 7, durationSeconds: 0.27 },
    ]) {
      expect(() => validateMediaIR({ ...ir, clock })).toThrow(/retained composition schedule/);
    }
  });

  it("keeps resolved clocks for one-frame, nested, simultaneous and routed programs", async () => {
    const size = { width: 320, height: 180 };
    const options = { size, fps: 25 };
    const clip = (frames: number) => video({
      size, fps: 25, duration: `${frames}f`, render,
    });
    const still = image({ size, render });
    const route = sequence([{ id: "lesson", content: choose({ short: clip(1), long: clip(7) }) }]);
    const cases = [
      { frames: 1, film: time(sequence([{ id: "one", content: clip(1) }]), options) },
      { frames: 57, film: time(sequence([
        { id: "opener", content: still, hold: "25f" },
        { id: "chapter", content: sequence([
          { id: "demo", content: clip(7) }, { id: "result", content: still, hold: "25f" },
        ]) },
      ]), options) },
      { frames: 7, film: time(together([
        { id: "short", content: clip(1), rect: { x: 0, y: 0, width: 160, height: 180 }, fit: "contain" },
        { id: "long", content: clip(7), rect: { x: 160, y: 0, width: 160, height: 180 }, fit: "contain" },
      ], { end: "hold" }), options) },
      { frames: 1, film: time(route, { ...options, routes: { lesson: "short" } }) },
      { frames: 7, film: time(route, { ...options, routes: { lesson: "long" } }) },
    ];
    for (const { film, frames } of cases) {
      const last = renderTemplateFrame({ template: film, frame: 999 });
      expect(last.frame).toBe(frames - 1);
      expect(last.ctx.totalFrames).toBe(frames);
      expect((await resolveMediaIR(film)).ir.clock).toEqual({
        fps: 25, totalFrames: frames, durationSeconds: frames / 25,
      });
    }
  });

  for (const { name, template } of SHAPES) {
    it(name, async () => {
      const runtime = resolveRuntimeTemplateInfo(template);
      const { ir } = await resolveMediaIR(template, {
        sourceId: `parity-${name.replace(/[^a-z]+/gi, "-")}`,
      });

      expect(runtime.isAnimated).toBe(inferTemplateAnimated(template));
      expect(ir.animated).toBe(runtime.isAnimated);
      expect({
        fps: ir.clock.fps,
        totalFrames: ir.clock.totalFrames,
        width: ir.canvas.width,
        height: ir.canvas.height,
      }).toEqual({
        fps: runtime.fps,
        totalFrames: runtime.totalFrames,
        width: runtime.width,
        height: runtime.height,
      });
    });
  }
});
