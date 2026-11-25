import { describe, expect, it } from "vitest";
import { Html, Stack, vector } from "@superimg/stdlib/tree";
import type { RenderContext, ResolveInput } from "@superimg/types";
import { cameraTransform } from "./camera.js";
import { cast, clamp, closeOn, film, span, type BubbleInput } from "./index.js";
import type { ScriptBlock } from "./types.js";

const stage = { width: 360, height: 640 };
const screen = { width: 1080, height: 1920 };
const context = <Data>(seconds: number, data: Data) => ({
  ...screen, timeline: { seconds }, data,
}) as RenderContext<Data>;
const resolveInput = <Data>(data: Data): ResolveInput<Data> => ({
  data, config: screen, asset: value => value, assets: {},
});
const script = (blocks: ScriptBlock[]) => ({ version: 1, hash: "fixture", blocks });
const speech = (id: string, who: string, lines = ["Hello."]): ScriptBlock =>
  ({ kind: "speech", id, who, lines, at: { start: 0.5, end: 1.5 } });

describe("film artists and camera", () => {
  it("matches the archived Pig 3 camera at edges and in the middle", () => {
    const cases = [[184, 427, 1.22, 365], [217, 399, 2.55, 334], [287, 402, 3, 330], [1, 639, 1.5, 320]] as const;
    for (const [x, y, scale, screenY] of cases) {
      expect(cameraTransform({ x, y }, { zoom: scale, y: screenY }, stage)).toEqual({
        scale, x: clamp(180 - x * scale, 360 * (1 - scale), 0), y: clamp(screenY - y * scale, 640 * (1 - scale), 0),
      });
    }
    expect(cameraTransform({ x: 100, y: 200 }, { zoom: 2, x: 110 }, stage)).toEqual({ x: -90, y: -80, scale: 2 });
    expect([span(0.99, 1, 1), span(1, 1, 1), span(1, 1, 0), span(1, Infinity, 2)]).toEqual([0, 1, 1, 0]);
  });

  it("passes a flipped and scaled drawn head through two enclosing camera transforms", () => {
    const member = cast("mira", { head: { x: 3, y: -8 }, draw: () => [vector.circle({ cx: 160, cy: 410, r: 10 })] });
    let bubble: BubbleInput | undefined;
    const media = film({
      stage, cast: [member],
      script: script([{ id: "shot", kind: "shot", hold: 2 }, speech("line", "Mira")]),
      data: { x: 1 },
      shots: [{
        shot: ({ data, t }: { data: { x: number }; t: number }) => [
          closeOn({ x: 150, y: 300 }, { zoom: 2 }, [
            closeOn({ x: 180, y: 340 }, { zoom: 1.5 }, [
              member(t, { x: 166 + data.x, y: 408 }, { flip: true, size: 2 }),
            ]),
          ]),
        ],
      }],
      bubble: input => { bubble = input; return ""; },
    });
    media.render(context(0.75, { x: 2 }));
    expect(bubble).toMatchObject({ who: "Mira", t: 0.75, start: 0.5, end: 1.5, index: 1, head: { x: 558, y: 1548 } });
  });

  it("uses the painted rig pose and lets explicit heads override tags", () => {
    const pip = cast("pip", { w: 5, h: 4, poses: {
      rest: [{ fill: "#fff", d: "M1 1h1v1z M3 3h1v1z" }],
      blink: [{ fill: "#fff", d: "M1 2h1v1z M2 3h1v1z" }],
    } });
    const heads: BubbleInput["head"][] = [];
    const media = film({
      stage, cast: { pip }, script: script([{ id: "shot", kind: "shot" }, speech("line", "pip")]),
      shots: [{ shot: ({ t }: { t: number }) => ({
        art: [pip(t, { x: 100, y: 260 }, { pose: "blink", size: 8, flip: true })],
        ...(t > 0.9 ? { heads: { pip: { x: 42, y: 50 } } } : {}),
      }) }],
      bubble: input => { heads.push(input.head); return ""; },
    });
    media.render(context(0.75, {}));
    media.render(context(1, {}));
    expect(heads).toEqual([{ x: 312, y: 732 }, { x: 126, y: 150 }]);
  });

  it("keeps the fable SVG wrapper, title paint order, and end fade", () => {
    const world = '<rect x="0" y="0" width="1080" height="1920" fill="#123"/>';
    const title = '<path d="M10 10h10v10z"/>';
    const fade = '<rect x="0" y="0" width="1080" height="1920" fill="#06070c" opacity="0.500"/>';
    const media = film({
      stage: screen, script: { ...script([{ id: "scene", kind: "shot", hold: 4 }]), title: "Fable" },
      score: "./score.wav", shots: [{ scene: () => world }],
      drawTitle: (t, name) => t > 0.3 && name === "Fable" ? title : "",
      bubble: () => "",
    });
    expect(media.config?.audio).toEqual({ id: "score", src: "./score.wav", role: "sfx", duration: "4s" });
    expect(media.render(context(3.6, {}))).toEqual(Stack({ width: "fill", height: "fill" },
      Html({ id: "scene", width: "fill", height: "fill", html:
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" style="display:block">${world}${title}${fade}</svg>`,
      })));
  });
});

it("publishes clock, cast, lettering and staging findings with the addressed block", async () => {
  const member = cast("pig", { head: { x: 0, y: 0 }, draw: () => [] });
  const media = film({
    stage, cast: [member], bubbleLimits: { lines: 1, chars: 8 },
    glyphs: text => !text.includes("💡"),
    script: script([
      { kind: "shot", id: "shot", hold: 1.25 },
      speech("pig-line", "pig"),
      speech("unknown-line", "chick", ["Needs a 💡."]),
      { kind: "shot", id: "missing" },
    ]),
    shots: [{ shot: () => [member(0, { x: 12, y: 40 })], extra: () => [] }],
    bubble: ({ head }) => [vector.rect({ x: head.x - 50, y: head.y, width: 60, height: 30 })],
  });
  const result = await media.resolve!(resolveInput({}));
  expect(result.cues?.map(cue => cue.id)).toEqual(["shot", "pig-line", "unknown-line", "missing"]);
  expect(result.cueFindings?.map(finding => [finding.id, finding.code])).toEqual([
    ["shot", "SHOT_SHORTER_THAN_LINES"],
    ["unknown-line", "UNKNOWN_SPEAKER"],
    ["unknown-line", "BUBBLE_TOO_LONG"],
    ["unknown-line", "MISSING_GLYPH"],
    ["missing", "UNPLACED_SHOT"],
    ["pig-line", "BUBBLE_OFF_CANVAS"],
    ["unknown-line", "NO_HEAD"],
  ]);
});

it("reports a string bubble that overflows even when its explicit head is inside", async () => {
  const media = film({
    stage: screen,
    script: script([{ id: "shot", kind: "shot" }, speech("cue", "pig")]),
    cast: { pig: cast("pig", { head: { x: 0, y: 0 }, draw: () => [] }) },
    shots: [{ shot: () => ({ art: "", heads: { pig: { x: 20, y: 440 } } }) }],
    bubble: () => '<defs><clipPath id="letter"><rect x="0" y="0" width="1" height="1"/></clipPath></defs><rect x="-5" y="390" width="40" height="25"/>',
  });
  expect((await media.resolve!(resolveInput({}))).cueFindings).toEqual([
    expect.objectContaining({ id: "cue", code: "BUBBLE_OFF_CANVAS" }),
  ]);
});
