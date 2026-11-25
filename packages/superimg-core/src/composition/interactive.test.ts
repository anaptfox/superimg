import { describe, expect, it } from "vitest";
import { svg, video, type InteractiveCompositionRuntime } from "@superimg/types";
import { Html } from "@superimg/stdlib/tree";
import { sequence } from "./sequence.js";
import { together } from "./together.js";
import { time, interactiveCompositionRuntimes } from "./time.js";
import { prepareComposition } from "./prepare.js";
import { asMarkup, makeTestContext } from "../__tests__/__test-utils__/index.js";

const size = { width: 320, height: 180 };

describe("interactive retained children", () => {
  it("uses the guide projection as a deterministic timed leaf and retains its host runtime", () => {
    const runtime: InteractiveCompositionRuntime = {
      media: video({
        size,
        fps: 30,
        duration: "1s",
        render: (ctx) => Html({ width: "fill", height: "fill", html: `guide-frame:${ctx.timeline.frame}` }),
      }),
      setScene() {},
      getSnapshot: () => ({ step: "intro" }),
      subscribe: () => () => undefined,
      attachActions: () => () => undefined,
    };
    const child = { kind: "interactive" as const, createCompositionRuntime: () => runtime };
    const program = sequence([{ id: "lesson", content: child }]);
    const timed = time(program, { size, fps: 30 });

    expect(timed.composition?.schedule.leaves).toMatchObject([{ path: "lesson", totalFrames: 30 }]);
    expect(interactiveCompositionRuntimes(timed)).toEqual([{ path: "lesson", runtime }]);
    expect(interactiveCompositionRuntimes({ ...timed })).toEqual([{ path: "lesson", runtime }]);
    expect(asMarkup(timed.render(makeTestContext({ globalFrame: 7, fps: 30, totalFrames: 30, width: 320, height: 180 })))).toContain("guide-frame:7");
  });

  it("adds qualified occurrence markup only when inspection is enabled", () => {
    const clip = video({ size, fps: 30, duration: "1s", render: () => Html({ html: "<button>Answer</button>" }) });
    const program = sequence([{ id: "lesson-answer", content: clip }]);
    const context = makeTestContext({ fps: 30, totalFrames: 30, width: 320, height: 180 });
    const standard = asMarkup(time(program, { size, fps: 30 }).render(context));
    const observed = asMarkup(time(program, { size, fps: 30, inspection: true }).render(context));
    expect(standard).not.toContain("data-si-occurrence");
    expect(observed).toContain('data-si-occurrence="lesson-answer"');
    expect(observed).toContain('style="display:contents"');
    expect(observed).toContain("<button>Answer</button>");
  });

  it("annotates SVG roots and every simultaneously active occurrence", () => {
    const vector = svg({ size, render: () => Html({ html: '<svg width="320" height="180"><circle r="8"/></svg>' }) });
    const projected = time(sequence([{ id: "vector", content: vector, hold: "1s" }]), { size, fps: 30, inspection: true });
    const context = makeTestContext({ fps: 30, totalFrames: 30, width: 320, height: 180 });
    const markup = asMarkup(projected.render(context));
    expect(markup).toContain('<svg data-si-occurrence="vector"');
    expect(markup).not.toContain("display:contents");
    const clip = video({ size, fps: 30, duration: "1s", render: () => Html({ html: "content" }) });
    const group = time(together([
      { id: "left", content: clip, fit: "contain", rect: { x: 0, y: 0, width: 160, height: 180 } },
      { id: "right", content: clip, fit: "contain", rect: { x: 160, y: 0, width: 160, height: 180 } },
    ], { end: "hold" }), { size, fps: 30, inspection: true });
    const grouped = asMarkup(group.render(context));
    expect(grouped).toContain('data-si-occurrence="left"');
    expect(grouped).toContain('data-si-occurrence="right"');
  });

  it("preserves the bound host runtime when preparing a timed projection", async () => {
    const runtime: InteractiveCompositionRuntime = {
      media: video({ size, fps: 30, duration: "1s", render: () => Html({ width: "fill", height: "fill", html: "guide" }) }),
      setScene() {},
      getSnapshot: () => ({ state: "guide" }),
      subscribe: () => () => undefined,
      attachActions: () => () => undefined,
    };
    const program = sequence([{ id: "lesson", content: { kind: "interactive" as const, createCompositionRuntime: () => runtime } }]);
    const prepared = await prepareComposition(program, {
      size,
      fps: 30,
      interactiveRuntimes: { lesson: runtime },
    });
    const projected = time(prepared.program, { size, fps: 30 });
    const boundRuntime = interactiveCompositionRuntimes(projected)[0]!.runtime;

    expect(boundRuntime.setScene).toBe(runtime.setScene);
    expect(boundRuntime.attachActions).toBe(runtime.attachActions);
    expect(boundRuntime.media.sample).toEqual(runtime.media.sample);
  });
});
