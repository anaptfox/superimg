import { describe, expect, it } from "vitest";
import { createTextMeasurer, type MetricFontFace } from "../svg/measure.js";
import {
  Code,
  Fill,
  Frame,
  Image,
  Plate,
  Text,
  Vector,
  Video,
  Html,
  lowerSvg,
  needsBrowser,
  vector,
} from "./index.js";

const SVG = 'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"';

function doc(width: number, height: number, body: string): string {
  return `<svg ${SVG} width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
}

describe("lowerSvg", () => {
  it("paints a frame fill and radius", () => {
    const svg = lowerSvg(
      Frame({ width: 200, height: 100, fill: "#123456", radius: 12 }),
      { width: 200, height: 100, background: "#101010" },
    );
    expect(svg).toBe(doc(
      200,
      100,
      '<rect x="0" y="0" width="200" height="100" fill="#101010"/><g><rect x="0" y="0" width="200" height="100" rx="12" ry="12" fill="#123456"/></g>',
    ));
  });

  it("insets a solid border by half the stroke", () => {
    const svg = lowerSvg(Frame({ width: 80, height: 40, border: "2px solid #fff" }), { width: 80, height: 40 });
    expect(svg).toBe(doc(
      80,
      40,
      '<g><rect x="1" y="1" width="78" height="38" fill="none" stroke="#fff" stroke-width="2"/></g>',
    ));
  });

  it("clips overflow hidden to the rounded box", () => {
    const svg = lowerSvg(
      Frame(
        { width: 100, height: 60, radius: 8, overflow: "hidden", fill: "#000" },
        Frame({ x: 10, y: 4, width: 20, height: 12, fill: "#fff" }),
      ),
      { width: 100, height: 60 },
    );
    expect(svg).toBe(doc(
      100,
      60,
      '<defs><clipPath id="si-clip-1"><rect x="0" y="0" width="100" height="60" rx="8" ry="8"/></clipPath></defs><g clip-path="url(#si-clip-1)"><rect x="0" y="0" width="100" height="60" rx="8" ry="8" fill="#000"/><g><rect x="10" y="4" width="20" height="12" fill="#fff"/></g></g>',
    ));
  });

  it("lowers a linear gradient from at", () => {
    const svg = lowerSvg(
      Fill({ gradient: { kind: "linear", at: "to right", stops: ["#fff 0%", "#000 100%"] } }),
      { width: 100, height: 80 },
    );
    expect(svg).toBe(doc(
      100,
      80,
      '<defs><linearGradient id="si-grad-1" gradientUnits="objectBoundingBox" x1="0" y1="0.5" x2="1" y2="0.5"><stop offset="0%" stop-color="#fff"/><stop offset="100%" stop-color="#000"/></linearGradient></defs><rect x="0" y="0" width="100" height="80" fill="url(#si-grad-1)"/>',
    ));
  });

  it("lowers a radial gradient from at", () => {
    const svg = lowerSvg(
      Fill({ gradient: { kind: "radial", at: "20% 80%", stops: ["#f00 0%", "#00f 100%"] } }),
      { width: 100, height: 80 },
    );
    expect(svg).toBe(doc(
      100,
      80,
      '<defs><radialGradient id="si-grad-1" gradientUnits="objectBoundingBox" cx="0.2" cy="0.8" r="1.1314"><stop offset="0%" stop-color="#f00"/><stop offset="100%" stop-color="#00f"/></radialGradient></defs><rect x="0" y="0" width="100" height="80" fill="url(#si-grad-1)"/>',
    ));
  });

  it("escapes text into xml", () => {
    const svg = lowerSvg(Text({ size: 20 }, "a<b&c"), { width: 200, height: 40 });
    expect(svg).toContain(">a&lt;b&amp;c</tspan>");
    expect(svg).not.toContain("a<b");
  });

  it("paints one text line from the laid-out line", () => {
    const svg = lowerSvg(Text({ size: 20 }, "Hello"), { width: 200, height: 40 });
    expect(svg).toBe(doc(
      200,
      40,
      '<text y="0" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="500" fill="#111827" text-anchor="start" xml:space="preserve"><tspan x="0" dy="18">Hello</tspan></text>',
    ));
  });

  it.each([
    ["left", "start", 0],
    ["center", "middle", 20],
    ["right", "end", 40],
  ] as const)("paints three wrapped lines aligned %s", (align, anchor, x) => {
    const svg = lowerSvg(Text({ size: 20, align }, "one two three"), { width: 40, height: 80 });
    expect(svg).toBe(doc(
      40,
      80,
      `<text y="0" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="500" fill="#111827" text-anchor="${anchor}" xml:space="preserve"><tspan x="${x}" dy="18">one</tspan><tspan x="${x}" dy="24">two</tspan><tspan x="${x}" dy="24">three</tspan></text>`,
    ));
  });

  it("uses half-leading so the measurer baseline is not raw ascent", () => {
    const face: MetricFontFace = {
      family: "Inter",
      weight: 500,
      style: "normal",
      metrics: {
        unitsPerEm: 1000,
        ascent: 500,
        descent: 200,
        advance: () => 500,
        kerning: () => 0,
      },
    };
    const svg = lowerSvg(Text({ size: 20, fontFamily: "Inter" }, "Hi"), {
      width: 100,
      height: 40,
      measurer: createTextMeasurer([face]),
    });
    // L=24, A=10, D=4 → (24 − 14) / 2 + 10
    expect(svg).toContain('dy="15"');
  });

  it("keeps a tight Anton-like line inside the line box except the CSS descender overhang", () => {
    const size = 96;
    const lineHeight = 0.9;
    const unitsPerEm = 1000;
    const ascentUnits = 980;
    const descentUnits = 240;
    const face: MetricFontFace = {
      family: "Anton",
      weight: 400,
      style: "normal",
      metrics: {
        unitsPerEm,
        ascent: ascentUnits,
        descent: descentUnits,
        advance: () => 500,
        kerning: () => 0,
      },
    };
    const svg = lowerSvg(
      Text({ size, lineHeight, weight: 400, fontFamily: "Anton" }, "Ag"),
      { width: 600, height: 200, measurer: createTextMeasurer([face]) },
    );
    const dy = Number(svg.match(/dy="([^"]+)"/)?.[1]);
    const ascent = ascentUnits * size / unitsPerEm;
    const descent = descentUnits * size / unitsPerEm;
    const lineBox = lineHeight * size;
    const box = { y: 0, height: lineBox };
    const baseline = box.y + dy;
    const glyphTop = baseline - ascent;
    const glyphBottom = baseline + descent;
    const cssDescenderOverhang = Math.max(0, (ascent + descent - lineBox) / 2);

    expect(dy).toBeCloseTo((lineBox - (ascent + descent)) / 2 + ascent, 4);
    expect(glyphTop).toBeGreaterThanOrEqual(box.y - cssDescenderOverhang - 1e-6);
    expect(glyphBottom).toBeLessThanOrEqual(box.y + box.height + cssDescenderOverhang + 1e-6);
    expect(box.y + ascent + descent).toBeGreaterThan(box.y + box.height + cssDescenderOverhang);
  });

  it("maps image cover to slice", () => {
    const svg = lowerSvg(Image({ src: "/a.jpg", fit: "cover", width: 120, height: 80 }), { width: 120, height: 80 });
    expect(svg).toBe(doc(
      120,
      80,
      '<image href="/a.jpg" xlink:href="/a.jpg" x="0" y="0" width="120" height="80" preserveAspectRatio="xMidYMid slice"/>',
    ));
  });

  it("maps image contain to meet and clips a radius", () => {
    const svg = lowerSvg(
      Image({ src: "/a.jpg", fit: "contain", width: 120, height: 80, radius: 4 }),
      { width: 120, height: 80 },
    );
    expect(svg).toBe(doc(
      120,
      80,
      '<defs><clipPath id="si-clip-1"><rect x="0" y="0" width="120" height="80" rx="4" ry="4"/></clipPath></defs><g clip-path="url(#si-clip-1)"><image href="/a.jpg" xlink:href="/a.jpg" x="0" y="0" width="120" height="80" preserveAspectRatio="xMidYMid meet"/></g>',
    ));
  });

  it("maps image fill to none", () => {
    const svg = lowerSvg(Image({ src: "/a.jpg", fit: "fill", width: 120, height: 80 }), { width: 120, height: 80 });
    expect(svg).toContain('preserveAspectRatio="none"');
  });

  it("paints code with theme token colors", () => {
    const svg = lowerSvg(Code({ code: "const x = 1;", width: 200, height: 48 }), { width: 200, height: 48 });
    expect(svg).toBe(doc(
      200,
      48,
      '<g><rect x="0" y="0" width="200" height="48" fill="#1e1e1e"/><text y="16" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="14" font-weight="400" fill="#d4d4d4" xml:space="preserve"><tspan x="16" dy="14.35"><tspan fill="#569cd6">const</tspan><tspan> </tspan><tspan>x</tspan><tspan> </tspan><tspan>=</tspan><tspan> </tspan><tspan fill="#b5cea8">1</tspan><tspan>;</tspan></tspan></text></g>',
    ));
  });

  it("embeds a nested vector with the existing svg serializer", () => {
    const svg = lowerSvg(
      Frame(
        { width: 200, height: 100 },
        Vector(
          {
            x: 10,
            y: 12,
            width: 80,
            height: 40,
            overflow: "visible",
            viewBox: { x: 0, y: 0, width: 80, height: 40 },
          },
          vector.path({ d: "M0 0 L80 40", stroke: "#fff" }),
        ),
      ),
      { width: 200, height: 100 },
    );
    expect(svg).toBe(doc(
      200,
      100,
      '<g><svg x="10" y="12" data-si-primitive="Vector" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40" preserveAspectRatio="xMidYMid meet" width="80" height="40"><path data-si-primitive="VectorPath" d="M0 0 L80 40" stroke="#fff"></path></svg></g>',
    ));
  });

  it("applies motion as a center transform and opacity", () => {
    const svg = lowerSvg(
      Frame({
        width: 80,
        height: 40,
        fill: "#abc",
        motion: {
          x: 6,
          y: 8,
          scale: 1.5,
          rotate: 30,
          opacity: 0.25,
          blur: 0,
          phase: "steady",
          style: "opacity:0.25",
          transform: "translate(6px, 8px)",
          filter: "",
        },
      }),
      { width: 80, height: 40 },
    );
    expect(svg).toBe(doc(
      80,
      40,
      '<g transform="translate(6 8) rotate(30 40 20) translate(40 20) scale(1.5) translate(-40 -20)" opacity="0.25"><rect x="0" y="0" width="80" height="40" fill="#abc"/></g>',
    ));
  });
});

describe("needsBrowser", () => {
  it("accepts a tree lowerSvg can paint", () => {
    const tree = Frame(
      { width: 100, height: 80, fill: "#111", radius: 4 },
      Text({ size: 20 }, "Hi"),
      Image({ src: "/a.jpg", width: 40, height: 40 }),
      Code({ code: "let n = 1;", width: 80, height: 40 }),
    );
    expect(needsBrowser(tree, { background: "#000", tailwind: false, stylesheets: [], inlineCss: [] })).toEqual({
      browser: false,
      reasons: [],
    });
  });

  it("flags Html, Video, and Plate", () => {
    expect(needsBrowser(Html({ id: "markup", html: "<b>x</b>" })).reasons).toEqual([{ nodeId: "markup", reason: "Html" }]);
    expect(needsBrowser(Video({ id: "clip", src: "/a.mp4" })).reasons).toEqual([{ nodeId: "clip", reason: "Video" }]);
    expect(needsBrowser(Plate({ src: "shot.mp4" })).reasons).toEqual([{ reason: "Plate" }]);
  });

  it("flags class names and unsupported style", () => {
    expect(needsBrowser(Frame({ className: "card", width: 10, height: 10 })).reasons).toEqual([{ reason: "className" }]);
    expect(needsBrowser(Frame({ id: "box", width: 10, height: 10, style: { boxShadow: "0 0 4px #000" } })).reasons).toEqual([
      { nodeId: "box", reason: "style:boxShadow" },
    ]);
    expect(needsBrowser(Frame({ width: 10, height: 10, style: "color:red" })).reasons).toEqual([{ reason: "style" }]);
  });

  it("flags unparseable gradients, borders, and radii", () => {
    expect(needsBrowser(Fill({ gradient: { kind: "linear", at: "sideways", stops: ["#fff 0%"] } })).reasons).toEqual([
      { reason: "gradient" },
    ]);
    expect(needsBrowser(Fill({ gradient: { kind: "radial", at: "50% 50%", size: "40% 40%", stops: ["#fff 0%", "#000 100%"] } })).reasons).toEqual([
      { reason: "gradient" },
    ]);
    expect(needsBrowser(Frame({ width: 10, height: 10, border: "1px dashed red" })).reasons).toEqual([{ reason: "border" }]);
    expect(needsBrowser(Frame({ width: 10, height: 10, radius: "50%" })).reasons).toEqual([{ reason: "radius" }]);
  });

  it("flags ken burns, blur, and other filters", () => {
    expect(needsBrowser(Image({ src: "/a.jpg", kenBurns: 0.4 })).reasons).toEqual([{ reason: "kenBurns" }]);
    expect(needsBrowser(Frame({
      width: 10,
      height: 10,
      motion: { x: 0, y: 0, scale: 1, rotate: 0, blur: 4, opacity: 1 },
    })).reasons).toEqual([{ reason: "blur" }]);
    expect(needsBrowser(Frame({
      width: 10,
      height: 10,
      style: { opacity: 1, phase: "steady", filter: "drop-shadow(0 0 2px #000)", blur: 0 },
    })).reasons).toEqual([{ reason: "filter" }]);
  });

  it("flags delivery config the svg document cannot carry", () => {
    const frame = Frame({ width: 10, height: 10, fill: "#fff" });
    expect(needsBrowser(frame, { tailwind: true }).reasons).toEqual([{ reason: "tailwind" }]);
    expect(needsBrowser(frame, { stylesheets: ["fonts.css"] }).reasons).toEqual([{ reason: "stylesheets" }]);
    expect(needsBrowser(frame, { inlineCss: ["body{color:#111}"] }).reasons).toEqual([{ reason: "inlineCss" }]);
    expect(needsBrowser(frame, { background: "linear-gradient(#000,#fff)" }).reasons).toEqual([{ reason: "background" }]);
  });
});

describe("portable opacity and blend modes", () => {
  it("lowers first-class paint and accepts supported style blend modes", () => {
    const tree = Frame({ id: "blend", width: 10, height: 10, opacity: 0.5, blendMode: "multiply" });
    expect(needsBrowser(tree).browser).toBe(false);
    expect(lowerSvg(tree, { width: 10, height: 10 })).toContain('mix-blend-mode:multiply');
    expect(needsBrowser(Frame({ style: { mixBlendMode: "screen" } })).browser).toBe(false);
    expect(needsBrowser(Frame({ id: "bad", style: { mixBlendMode: "plus-lighter" } })).reasons).toContainEqual({ nodeId: "bad", reason: "style:mixBlendMode" });
    expect(needsBrowser(Frame({ id: "bad", blendMode: "plus-lighter" as never })).reasons).toContainEqual({ nodeId: "bad", reason: "blendMode" });
  });
});
