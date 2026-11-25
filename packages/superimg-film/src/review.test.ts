import { describe, expect, it } from "vitest";
import { vector } from "@superimg/stdlib/tree";
import type { RenderContext, ResolveInput } from "@superimg/types";
import { cameraTransform } from "./camera.js";
import { paintedCells } from "./cast.js";
import { clock, publishedDuration, shotAt } from "./clock.js";
import { cast, closeOn, film, mixColor, place, type BubbleInput, type ShotContext } from "./index.js";
import { paintedBounds } from "./measure.js";
import type { ScriptBlock, ShotArt } from "./types.js";

const stage = { width: 360, height: 640 };
const screen = { width: 1080, height: 1920 };
const context = <Data>(seconds: number, data: Data = {} as Data) => ({
  ...screen, timeline: { seconds }, data,
}) as RenderContext<Data>;
const resolveInput = (): ResolveInput<object> => ({ data: {}, config: screen, asset: value => value, assets: {}, });
const script = (blocks: ScriptBlock[], title?: string) => ({ version: 1, hash: "fixture", blocks, ...(title ? { title } : {}) });
const speech = (id: string, who: string, lines = ["Hello."]): ScriptBlock =>
  ({ kind: "speech", id, who, lines, at: { start: 0.5, end: 1.5 } });
const pig = cast("pig", { head: { x: 0, y: 0 }, draw: () => [] });

/** The finding codes a bubble earns when pig's head is at `head` in an SVG-string shot. */
async function bubbleCodes(bubble: (b: BubbleInput) => ShotArt, head = { x: 540, y: 900 }) {
  const media = film({
    stage: screen, cast: [pig],
    script: script([{ id: "shot", kind: "shot", hold: 3 }, speech("line", "pig")]),
    shots: [{ shot: () => ({ art: "", heads: { pig: head } }) }],
    bubble,
  });
  return (await media.resolve!(resolveInput())).cueFindings!.map(finding => finding.code);
}

describe("bubble placement measures what the bubble paints", () => {
  it("accepts an SVG-string bubble with centred text", async () => {
    expect(await bubbleCodes(() => '<rect x="100" y="700" width="880" height="120" rx="30"/><text x="540" y="780" font-size="43" text-anchor="middle" fill="#fff">Did the light go out?</text>')).toEqual([]);
  });

  it("flags text that runs past the edge by anchor and size", async () => {
    expect(await bubbleCodes(() => '<text x="1000" y="780" font-size="43">A line that runs on</text>')).toEqual(["BUBBLE_OFF_CANVAS"]);
    expect(await bubbleCodes(() => '<text x="60" y="780" font-size="43" text-anchor="end">Hello</text>')).toEqual(["BUBBLE_OFF_CANVAS"]);
  });

  it("accepts a clamped bubble for a speaker who is off frame", async () => {
    const clamped = ({ head }: BubbleInput) => [vector.rect({ x: Math.max(100, head.x - 200), y: 700, width: 400, height: 100 })];
    expect(await bubbleCodes(clamped, { x: -80, y: 900 })).toEqual([]);
    expect(await bubbleCodes(({ head }) => [vector.rect({ x: head.x - 200, y: 700, width: 400, height: 100 })], { x: -80, y: 900 })).toEqual(["BUBBLE_OFF_CANVAS"]);
  });

  it.each([
    ["polygon", '<polygon points="900,700 1100,700 1000,800" fill="#000"/>', vector.polygon({ points: [[900, 700], [1100, 700], [1000, 800]], fill: "#000" })],
    ["ellipse", '<ellipse cx="1060" cy="800" rx="60" ry="20" fill="#000"/>', vector.ellipse({ cx: 1060, cy: 800, rx: 60, ry: 20, fill: "#000" })],
    ["line", '<line x1="900" y1="800" x2="1200" y2="800" stroke="#000" stroke-width="4"/>', vector.line({ x1: 900, y1: 800, x2: 1200, y2: 800, stroke: "#000", strokeWidth: 4 })],
    ["polyline", '<polyline points="900,700 1100,700" stroke="#000" fill="none"/>', vector.polyline({ points: [[900, 700], [1100, 700]], stroke: "#000", fill: "none" })],
    ["path", '<path d="M900 700 L1100 700 L1000 800z" fill="#000"/>', vector.path({ d: "M900 700 L1100 700 L1000 800z", fill: "#000" })],
    ["relative path", '<path d="m900 700 h200 v50 z" fill="#000"/>', vector.path({ d: "m900 700 h200 v50 z", fill: "#000" })],
    ["transformed group", '<g transform="translate(900 0)"><rect x="0" y="700" width="200" height="50"/></g>', vector.group({ transform: { x: 900 } }, vector.rect({ x: 0, y: 700, width: 200, height: 50 }))],
  ])("flags a %s that leaves the canvas, as markup and as typed art", async (_name, markup, typed) => {
    expect(await bubbleCodes(() => markup)).toEqual(["BUBBLE_OFF_CANVAS"]);
    expect(await bubbleCodes(() => [typed])).toEqual(["BUBBLE_OFF_CANVAS"]);
  });

  it("keeps a transformed shape that lands inside the canvas", async () => {
    expect(await bubbleCodes(() => [place(800, 600, [vector.rect({ x: -700, y: 100, width: 800, height: 50 })])])).toEqual([]);
    expect(await bubbleCodes(() => '<g transform="translate(-100 0)"><rect x="150" y="700" width="200" height="50"/></g>')).toEqual([]);
  });

  it("skips invisible nodes and honours clips", async () => {
    expect(await bubbleCodes(() => '<g opacity="0"><rect x="-90" y="700" width="50" height="50"/></g>')).toEqual([]);
    expect(await bubbleCodes(() => [vector.rect({ x: -90, y: 700, width: 50, height: 50, opacity: 0 })])).toEqual([]);
    expect(await bubbleCodes(() => '<rect x="-90" y="700" width="50" height="50" style="opacity:0"/>')).toEqual([]);
    expect(await bubbleCodes(() => '<g display="none"><rect x="-90" y="700" width="50" height="50"/></g>')).toEqual([]);
    const clipped = '<defs><clipPath id="c"><rect x="0" y="0" width="1080" height="1920"/></clipPath></defs><rect x="-90" y="700" width="400" height="50" clip-path="url(#c)"/>';
    expect(await bubbleCodes(() => clipped)).toEqual([]);
    expect(await bubbleCodes(() => clipped.replace(' clip-path="url(#c)"', ""))).toEqual(["BUBBLE_OFF_CANVAS"]);
  });

  it("reports unparseable SVG as its own finding", async () => {
    expect(await bubbleCodes(() => '<rect x="-9"')).toEqual(["BUBBLE_UNPARSEABLE"]);
    expect(await bubbleCodes(() => '<g><rect x="1" y="1" width="5" height="5"/>')).toEqual(["BUBBLE_UNPARSEABLE"]);
    expect(await bubbleCodes(() => '<g></rect></g>')).toEqual(["BUBBLE_UNPARSEABLE"]);
    expect(await bubbleCodes(() => '<rect x="1" y="1" width="5" height="5" transform="wobble(3)"/>')).toEqual(["BUBBLE_UNPARSEABLE"]);
  });

  it("reads markup as a browser would: style attributes, unresolved references and unknown elements are fine", async () => {
    const lenient = '<style>.a{fill:red}</style><rect class="a" x="100" y="700" width="50" height="50" fill="url(#missing)" style="stroke:#000"/><image href="a.png" x="10" y="10" width="5" height="5"/><svg:g xmlns:svg="x"><rect x="1" y="1" width="2" height="2"/></svg:g>';
    expect(await bubbleCodes(() => lenient)).toEqual([]);
    expect(await bubbleCodes(() => '<rect x="1000" y="700" width="200" height="50" style="fill:#000"/>')).toEqual(["BUBBLE_OFF_CANVAS"]);
    expect(await bubbleCodes(() => '<text x="540" y="780">Fish &amp; chips &lt;3</text><!-- c --><![CDATA[x]]>')).toEqual([]);
  });

  it("measures typed text, arcs and curves", () => {
    const text = paintedBounds([vector.text({ x: 500, y: 300, anchor: "middle", size: 40, fill: "#000" }, "Hello")]).box!;
    expect(text.x0).toBeCloseTo(500 - 55);
    expect(text.x1).toBeCloseTo(500 + 55);
    const curve = paintedBounds([vector.path({ d: "M0 100 C 50 0 150 0 200 100", fill: "#000" })]).box!;
    expect(curve.y0).toBeGreaterThan(20);
    expect(curve.y0).toBeLessThan(30);
    const arc = paintedBounds([vector.path({ d: "M100 100 A50 50 0 0 1 200 100", fill: "none", stroke: "#000", strokeWidth: 2 })]).box!;
    expect(arc.y0).toBeCloseTo(49, 0);
  });
});

describe("title and painter are separate", () => {
  const painted: string[] = [];
  const series = {
    stage: screen, cast: [pig], bubble: () => "",
    drawTitle: (_t: number, title: string) => { painted.push(title); return ""; },
  };
  const blocks = [{ id: "shot", kind: "shot", hold: 2 }] as ScriptBlock[];
  const shots = [{ shot: () => "" }];

  it("defaults to the script title and survives a retitle spread", () => {
    painted.length = 0;
    film({ ...series, script: script(blocks, "From the script"), shots }).render(context(0.5));
    film({ ...series, title: "Retitled", script: script(blocks, "From the script"), shots }).render(context(0.5));
    film({ ...series, script: script(blocks), shots }).render(context(0.5));
    expect(painted).toEqual(["From the script", "Retitled", ""]);
  });
});

describe("float drift", () => {
  it("finds no shortage at an exact boundary of summed reading times", () => {
    const result = clock([
      { kind: "shot", id: "exact", hold: 1.9 },
      { kind: "speech", id: "line", who: "pig", lines: ["Hi"], at: { start: 0.3, end: 0.3 + 1.6 } },
    ]);
    expect(0.3 + 1.6).toBeGreaterThan(1.9);
    expect(result.findings).toEqual([]);
    expect(clock([
      { kind: "shot", id: "short", hold: 1.9 },
      { kind: "speech", id: "line", who: "pig", lines: ["Hi"], at: { start: 0.3, end: 1.9001 } },
    ]).findings.map(finding => finding.code)).toEqual(["SHOT_SHORTER_THAN_LINES"]);
  });

  it("selects the next shot at an exact cut frame", () => {
    const holds = [0.1, 0.2, 0.3, 0.7]; // sums to 1.3000000000000003 in floats
    const { shots, total } = clock(holds.map((hold, i) => ({ kind: "shot", id: `s${i}`, hold }) as ScriptBlock));
    expect(shots[3]!.start).toBe(0.6);
    expect(shots[2]!.end).toBe(0.6); // integer microsecond summation prevents float drift
    // Exact decimal cuts at 0.1, 0.3, 0.6 on a 10 fps clock land on frames 1, 3, 6.
    const picked = Array.from({ length: 13 }, (_, frame) => shotAt(shots, frame / 10).id);
    expect(picked).toEqual(["s0", "s1", "s1", "s2", "s2", "s2", "s3", "s3", "s3", "s3", "s3", "s3", "s3"]);
    expect(total).toBe(1.3);
    // Even if a caller passes drifted floats directly to shotAt(), EPSILON still picks the next shot.
    const drifted = shots.map((shot, i) => (i === 2 ? { ...shot, end: 0.6000000000000001 } : shot));
    expect(shotAt(drifted, 0.6).id).toBe("s3");
  });

  it("counts frames in exact decimals", () => {
    // 2.2 s at 25 fps is 55 frames; the renderer's float ceil(2.2 * 25) says 56.
    expect(Math.ceil(2.2 * 25)).toBe(56);
    const { seconds, frames } = publishedDuration(2.2, 25);
    expect(frames).toBe(55);
    expect(Math.ceil(seconds * 25)).toBe(55);
    // Clean totals are left exactly as written.
    expect(publishedDuration(4, 30).seconds).toBe(4);
    expect(publishedDuration(2.4 + 0.1 + 0.2 + 0.30000000000000004, 30).seconds).toBe(3);
    const media = film({
      stage, script: script([{ kind: "shot", id: "a", hold: 1.1 }, { kind: "shot", id: "b", hold: 1.1 }]),
      shots: [{ a: () => [], b: () => [] }], bubble: () => "", fps: 25,
    });
    expect(Math.ceil(parseFloat(String(media.config?.duration)) * 25)).toBe(55);
  });

  it("publishes cue times without float dust", () => {
    const { cues } = clock([
      { kind: "shot", id: "a", hold: 0.1 }, { kind: "shot", id: "b", hold: 0.2 }, { kind: "shot", id: "c", hold: 0.3 },
    ]);
    expect(cues.map(cue => [cue.start, cue.end])).toEqual([[0, 0.1], [0.1, 0.3], [0.3, 0.6]]);
  });
});

describe("shot length", () => {
  it("uses the latest line end, whatever the script order", () => {
    const result = clock([
      { kind: "shot", id: "s" },
      { kind: "speech", id: "late", who: "pig", lines: ["Later."], at: { start: 1, end: 4 } },
      { kind: "card", id: "early", lines: ["Earlier."], at: { start: 0, end: 1 } },
    ]);
    expect(result.shots[0]!.duration).toBeCloseTo(4.3);
    expect(result.findings).toEqual([]);
  });
});

describe("rig bounds", () => {
  it("honours run lengths in absolute and relative paths", () => {
    expect(paintedCells([{ fill: "#fff", d: "M2 1h3v1H2z" }])).toEqual({ left: 2, right: 5, top: 1 });
    expect(paintedCells([{ fill: "#fff", d: "M2 3h1v-2h4V5H1z" }])).toEqual({ left: 1, right: 7, top: 1 });
    expect(paintedCells([{ fill: "#fff", d: "m2 1 h3 v1 h-3z M0 4h1" }])).toEqual({ left: 0, right: 5, top: 1 });
    expect(paintedCells([{ fill: "#fff", d: "" }])).toBeUndefined();
  });

  it("centres the head on a wide painted run", () => {
    const wide = cast("wide", { w: 12, h: 6, poses: { rest: [{ fill: "#fff", d: "M2 1h8v2H2z" }] } });
    const heads: BubbleInput["head"][] = [];
    film({
      stage, cast: [wide], script: script([{ id: "shot", kind: "shot" }, speech("line", "wide")]),
      shots: [{ shot: ({ t }: ShotContext) => [wide(t, { x: 100, y: 200 }, { size: 4, shadow: false })] }],
      bubble: input => { heads.push(input.head); return ""; },
    }).render(context(0.75));
    // painted columns 2..10, centre 6 → 100 (rest centre is the placement point).
    expect(heads[0]!.x).toBeCloseTo(100 * 3);
  });
});

describe("head projection composes every transform", () => {
  const heads = (build: (member: ReturnType<typeof cast>, t: number) => ShotArt) => {
    const member = cast("mira", { head: { x: 0, y: -10 }, draw: () => [vector.circle({ cx: 0, cy: 0, r: 5 })] });
    const seen: BubbleInput["head"][] = [];
    film({
      stage, cast: [member], script: script([{ id: "shot", kind: "shot" }, speech("line", "mira")]),
      shots: [{ shot: ({ t }: ShotContext) => build(member, t) }],
      bubble: input => { seen.push(input.head); return ""; },
    }).render(context(0.75));
    return seen[0]!;
  };

  it("maps a head through place(), a transformed group and a camera", () => {
    const at = { x: 0, y: 0 };
    expect(heads((m, t) => [place(100, 200, [m(t, at)], 2)])).toEqual({ x: 300, y: 540 });
    expect(heads((m, t) => [vector.group({ transform: { x: 10, y: 20, scale: 2 } }, vector.group({ transform: "translate(5 5)" }, m(t, at)))])).toEqual({ x: 3 * (10 + 10), y: 3 * (20 + 2 * (5 - 10)) });
    const rotated = heads((m, t) => [vector.group({ transform: { x: 100, y: 100, rotate: 90 } }, m(t, at))]);
    expect(rotated.x).toBeCloseTo(3 * 110);
    expect(rotated.y).toBeCloseTo(3 * 100);
    const camera = heads((m, t) => [closeOn({ x: 180, y: 320 }, { zoom: 2 }, [place(10, 10, [m(t, at)])])]);
    expect(camera).toEqual({ x: 3 * (2 * 10 - 180), y: 3 * (2 * 0 - 320) });
  });
});

describe("camera below zoom 1", () => {
  it("letterboxes centred on the point instead of collapsing to the corner", () => {
    expect(cameraTransform({ x: 180, y: 320 }, { zoom: 0.5 }, stage)).toEqual({ scale: 0.5, x: 90, y: 160 });
    // An off-centre point lands on the anchor while the whole stage stays on screen.
    expect(cameraTransform({ x: 0, y: 0 }, { zoom: 0.5 }, stage)).toEqual({ scale: 0.5, x: 180, y: 320 });
    expect(cameraTransform({ x: 360, y: 640 }, { zoom: 0.5 }, stage)).toEqual({ scale: 0.5, x: 0, y: 0 });
    // A point that would push the stage off screen is held at the edge.
    expect(cameraTransform({ x: 0, y: 0 }, { zoom: 0.5, x: 300, y: 600 }, stage)).toEqual({ scale: 0.5, x: 180, y: 320 });
    expect(cameraTransform({ x: 100, y: 200 }, { zoom: 0.5, x: 120, y: 300 }, stage)).toEqual({ scale: 0.5, x: 70, y: 200 });
    // At zoom 1 the camera is the identity, as before.
    expect(cameraTransform({ x: 50, y: 60 }, { zoom: 1 }, stage)).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it("rejects a zoom that cannot be a camera", () => {
    for (const zoom of [0, -1, NaN, Infinity]) expect(() => closeOn({ x: 0, y: 0 }, { zoom }, [])).toThrow(/positive zoom/);
  });
});

describe("clock validation", () => {
  it("reports a still outside its shot", () => {
    const codes = (still: number) => clock([{ kind: "shot", id: "s", hold: 2, still }]).findings.map(finding => finding.code);
    expect(codes(2.5)).toEqual(["STILL_OUTSIDE_SHOT"]);
    expect(codes(-0.1)).toEqual(["STILL_OUTSIDE_SHOT"]);
    expect(codes(2)).toEqual([]);
  });

  it("never lets a non-positive hold produce NaN", () => {
    for (const hold of [0, -3, NaN, Infinity]) {
      const result = clock([{ kind: "shot", id: "s", hold }]);
      expect(result.findings.map(finding => finding.code)).toEqual(["INVALID_HOLD"]);
      expect(result.shots[0]!.duration).toBe(2.4);
      expect(Number.isFinite(result.total)).toBe(true);
    }
    const us: number[] = [];
    film({
      stage, script: script([{ kind: "shot", id: "s", hold: 0 }]), bubble: () => "",
      shots: [{ s: ({ u }: ShotContext) => { us.push(u); return []; } }],
    }).render(context(1));
    expect(us).toEqual([1 / 2.4]);
  });

  it("reports a speech or card before the first shot", () => {
    const result = clock([
      { kind: "speech", id: "early", who: "pig", lines: ["Hi"] },
      { kind: "card", id: null, lines: ["Credit"] },
      { kind: "shot", id: "s", hold: 1 },
    ]);
    expect(result.findings).toEqual([
      expect.objectContaining({ id: "early", code: "BLOCK_BEFORE_SHOT" }),
      expect.objectContaining({ id: "block-1", code: "BLOCK_BEFORE_SHOT" }),
    ]);
    expect(result.total).toBe(1);
  });
});

describe("script findings", () => {
  const shotBlocks = [{ kind: "shot", id: "a", hold: 2 }, speech("a-line", "mira")] as ScriptBlock[];
  const find = async (options: Partial<Parameters<typeof film>[0]> = {}) => {
    const media = film({
      stage, script: script(shotBlocks), shots: [{ a: () => ({ art: "", heads: { mira: { x: 180, y: 320 } } }) }],
      bubble: () => "", cast: [cast("Mira", { head: { x: 0, y: 0 }, draw: () => [] })], ...options,
    });
    return (await media.resolve!(resolveInput())).cueFindings!.map(finding => [finding.id, finding.code]);
  };

  it("lets a shot module export helpers", async () => {
    expect(await find({ shots: [{ a: () => ({ art: "", heads: { mira: { x: 180, y: 320 } } }), palette: () => [], PI: 3, helper() {} }] })).toEqual([]);
  });

  it("reports one shot id exported by two modules", async () => {
    const draw = () => ({ art: "", heads: { mira: { x: 180, y: 320 } } });
    expect(await find({ shots: [{ a: draw, helper: () => 1 }, { a: draw, helper: () => 2 }] })).toEqual([["a", "DUPLICATE_SHOT"]]);
  });

  it("still reports a shot block with no export", async () => {
    expect(await find({ shots: [{}] })).toEqual([["a", "UNPLACED_SHOT"]]);
  });

  it("identifies speakers by cast name, whatever the key", async () => {
    const mira = cast("Mira", { head: { x: 0, y: 0 }, draw: () => [] });
    expect(await find({ cast: { hero: mira } })).toEqual([]);
    expect(await find({ cast: { mira: cast("Pip", { head: { x: 0, y: 0 }, draw: () => [] }) } })).toEqual([["a-line", "UNKNOWN_SPEAKER"]]);
  });

  it("refuses a cast entry that is not made by cast()", () => {
    expect(() => film({
      stage, script: script(shotBlocks), shots: [{}], bubble: () => "",
      cast: { mira: (() => []) as never },
    })).toThrow(/under "mira"/);
    expect(() => film({
      stage, script: script(shotBlocks), shots: [{}], bubble: () => "", cast: [(() => []) as never],
    })).toThrow(/not made by cast/);
  });

  it("checks the speaker name's glyphs only when the bubble draws names", async () => {
    const glyphs = (text: string) => !/[A-Z]/.test(text);
    const blocks = script([{ kind: "shot", id: "a", hold: 2 }, { kind: "speech", id: "a-line", who: "mira", lines: ["lowercase only"], at: { start: 0.2, end: 1 } }]);
    const opts = { script: blocks, glyphs, shots: [{ a: () => ({ art: "", heads: { mira: { x: 180, y: 320 } } }) }] };
    expect(await find({ ...opts })).toEqual([["a-line", "MISSING_GLYPH"]]);
    expect(await find({ ...opts, bubbleShowsName: false })).toEqual([]);
  });

  it("checks card attribution, sign and source, and demands a card painter", async () => {
    const glyphs = (text: string) => !text.includes("é");
    const card = (extra: object) => script([{ kind: "shot", id: "a", hold: 2 }, { kind: "card", id: "c", lines: ["Plain"], at: { start: 0, end: 1 }, ...extra } as ScriptBlock]);
    const shots = [{ a: () => [] }];
    expect(await find({ script: card({ source: "Café" }), glyphs, card: () => "", shots })).toEqual([["c", "MISSING_GLYPH"]]);
    expect(await find({ script: card({ sign: "é" }), glyphs, card: () => "", shots })).toEqual([["c", "MISSING_GLYPH"]]);
    expect(await find({ script: card({}), glyphs, shots })).toEqual([["c", "NO_CARD_PAINTER"]]);
    expect(await find({ script: card({}), glyphs, card: () => "", shots })).toEqual([]);
  });
});

describe("rendering", () => {
  const blocks = (hold: number) => [{ kind: "shot", id: "s", hold }] as ScriptBlock[];
  const html = (value: unknown) => JSON.stringify(value);

  it("fades to the series background", () => {
    const media = film({ stage: screen, background: "#102030", script: script(blocks(4)), shots: [{ s: () => "" }], bubble: () => "", ending: "fade" });
    expect(html(media.render(context(3.9)))).toContain('fill=\\"#102030\\"');
    const typed = film({ stage, background: "#102030", script: script(blocks(4)), shots: [{ s: () => [] }], bubble: () => "", ending: "fade" });
    expect(html(typed.render(context(3.9)))).toContain('fill=\\"#102030\\"');
    const plain = film({ stage, script: script(blocks(4)), shots: [{ s: () => [] }], bubble: () => "", ending: "fade" });
    expect(html(plain.render(context(3.9)))).toContain('fill=\\"#000\\"');
  });

  it("does not start a short film faded", () => {
    const media = film({ stage: screen, script: script(blocks(0.5)), shots: [{ s: () => "" }], bubble: () => "" });
    expect(html(media.render(context(0)))).not.toContain("<rect");
    expect(html(media.render(context(0.2)))).toContain('opacity=\\"');
  });

  it("paints the series background behind a contained string stage", () => {
    const media = film({
      stage: { width: 360, height: 360 }, fit: "contain", background: "#abc", script: script(blocks(2)),
      shots: [{ s: () => "<circle/>" }], bubble: () => "", ending: "cut",
    });
    const output = html(media.render(context(0.5)));
    expect(output).toContain('fill=\\"#abc\\"');
    expect(output).not.toContain("slice");
  });

  it("lets the series override how the stage fits", () => {
    const square = { width: 360, height: 360 };
    const cover = film({ stage: square, fit: "cover", script: script(blocks(2)), shots: [{ s: () => [] }], bubble: () => "" });
    expect(html(cover.render(context(0.5)))).toContain('"fit":"cover"');
    const contain = film({ stage: square, script: script(blocks(2)), shots: [{ s: () => [] }], bubble: () => "" });
    expect(html(contain.render(context(0.5)))).not.toContain('"fit":"cover"');
    // Heads follow the fit: a square stage on a portrait screen.
    const seen: Record<string, BubbleInput["head"]> = {};
    for (const fit of ["contain", "cover"] as const) {
      film({
        stage: square, fit, cast: [pig], script: script([{ id: "s", kind: "shot" }, speech("l", "pig")]),
        shots: [{ s: () => ({ art: [], heads: { pig: { x: 0, y: 0 } } }) }],
        bubble: input => { seen[fit] = input.head; return ""; },
      }).render(context(0.75));
    }
    expect(seen.contain).toEqual({ x: 0, y: (1920 - 1080) / 2 });
    expect(seen.cover).toEqual({ x: (1080 - 1920) / 2, y: 0 });
  });

  it("keeps the score's role at sfx, which the archived films export", () => {
    const media = film({ stage, script: script(blocks(2)), shots: [{ s: () => [] }], bubble: () => "", score: "./score.wav" });
    expect(media.config?.audio).toMatchObject({ role: "sfx" });
  });

  it("gives a shot its scheduled lines", () => {
    let lines: ShotContext["lines"] = [];
    film({
      stage, cast: [pig], script: script([{ id: "s", kind: "shot", hold: 4 }, speech("hello", "pig"), { kind: "card", id: "card", lines: ["Fin"], at: { start: 2, end: 3 } }]),
      shots: [{ s: (s: ShotContext) => { lines = s.lines; return []; } }], bubble: () => "",
    }).render(context(0.1));
    expect(lines).toEqual([
      { id: "hello", kind: "speech", who: "pig", lines: ["Hello."], fields: {}, start: 0.5, typed: 0.5 + 6 * 0.021, end: 1.5 },
      { id: "card", kind: "card", lines: ["Fin"], fields: {}, start: 2, typed: 2 + 3 * 0.021, end: 3 },
    ]);
  });
});

describe("cast placement", () => {
  const rig = cast("pip", { w: 5, h: 4, poses: { rest: [{ fill: "#fff", d: "M1 1h3v3H1z" }] } });
  const draw = (o: object) => {
    const group = rig(0, { x: 100, y: 200 }, { size: 8, ...o }) as unknown as { children: { type: string; props: Record<string, unknown> }[] };
    return { shadow: group.children[0]!.props, sprite: group.children[1]!.props };
  };

  it("lifts the sprite and head but not the shadow", () => {
    const grounded = draw({});
    const lifted = draw({ lift: 30 });
    expect(lifted.shadow).toEqual(grounded.shadow);
    expect((lifted.sprite.transform as { y: number }).y).toBe((grounded.sprite.transform as { y: number }).y - 30);
    const heads: number[] = [];
    for (const lift of [0, 30]) {
      film({
        stage, cast: [rig], script: script([{ id: "s", kind: "shot" }, speech("l", "pip")]),
        shots: [{ s: ({ t }: ShotContext) => [rig(t, { x: 100, y: 200 }, { size: 8, lift })] }],
        bubble: input => { heads.push(input.head.y); return ""; },
      }).render(context(0.75));
    }
    expect(heads[0]! - heads[1]!).toBeCloseTo(90);
  });

  it("fades the shadow with the sprite", () => {
    expect(draw({}).shadow.opacity).toBe(0.26);
    expect(draw({ opacity: 0.5 }).shadow.opacity).toBe(0.13);
    expect(draw({ opacity: 0.5 }).sprite.opacity).toBe(0.5);
  });
});

describe("mixColor", () => {
  it("accepts short hex", () => {
    expect(mixColor("#fff", "#000", 0.5)).toBe("#808080");
    expect(mixColor("#f00", "#00ff00", 1)).toBe("#00ff00");
    expect(mixColor("#102030", "#102030", 0.3)).toBe("#102030");
  });
});
