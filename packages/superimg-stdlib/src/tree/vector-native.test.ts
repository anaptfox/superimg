import { describe, expect, it, vi } from "vitest";
import { h } from "./h.js";
import { lower } from "./lower.js";
import { lowerSvg } from "./lower-svg.js";
import { walkMediaTree } from "./walk.js";
import { Vector, vector } from "./vector.js";

function scene() {
  return Vector({ width: 200, height: 100 },
    vector.defs(
      vector.linearGradient({ id: "ink", x1: 0, y1: 0, x2: 1, y2: 1 },
        vector.stop({ stopColor: "#123" }), vector.stop({ offset: 1, stopColor: "#456", stopOpacity: .5 })),
      vector.pattern({ id: "dots", width: 20, height: 20, patternUnits: "userSpaceOnUse" },
        vector.circle({ cx: 5, cy: 5, r: 3, fill: "#abc" })),
      vector.filter({ id: "glow", x: "-40%", width: "180%" },
        vector.gaussianBlur({ stdDeviation: 4, result: "blur" }),
        vector.merge(vector.mergeNode({ in: "blur" }), vector.mergeNode({ in: "SourceGraphic" }))),
      vector.filter({ id: "ink-print" },
        vector.turbulence({ type: "fractalNoise", baseFrequency: .06, numOctaves: 2, seed: 17, result: "noise" }),
        vector.displacementMap({ in: "SourceGraphic", in2: "noise", scale: 3, xChannelSelector: "R", yChannelSelector: "G" })),
    ),
    vector.group({ fill: "url(#ink)", stroke: "#123", strokeWidth: 1.3, filter: "glow", "data-subject": "globe" },
      vector.viewport({ x: 30, y: 20, width: 80, height: 60, viewBox: { x: 0, y: 0, width: 40, height: 30 } },
        vector.circle({ id: "globe", cx: 20, cy: 15, r: 10 }),
        vector.rect({ id: "pixel", x: 3, y: 2, width: 6, height: 6, shapeRendering: "crispEdges" }))),
  );
}

describe("native vector materials", () => {
  it("preserves non-scaling strokes through both lowering paths and inspection", () => {
    const tree = Vector({ width: 200, height: 100 },
      vector.group({ transform: { scale: 2 } },
        vector.path({ id: "fixed-stroke", d: "M0 0L50 20", stroke: "#123", strokeWidth: 3, vectorEffect: "non-scaling-stroke" }),
        vector.rect({ width: 20, height: 10, vectorEffect: "none" })));
    for (const markup of [lower(tree), lowerSvg(tree)]) {
      expect(markup).toContain('vector-effect="non-scaling-stroke"');
      expect(markup).toContain('vector-effect="none"');
      expect(markup).not.toContain("vectorEffect=");
      expect(markup).toContain('stroke-width="3"');
    }
    expect(walkMediaTree(tree, { width: 200, height: 100 }).find(node => node.id === "fixed-stroke")?.paint)
      .toEqual({ stroke: "#123", strokeWidth: 3, vectorEffect: "non-scaling-stroke" });
  });

  it("serializes typed paint definitions and native filter inputs without changing namespaces", () => {
    const html = lower(scene());
    expect(html).toContain('<linearGradient id="ink"');
    expect(html).toContain('stop-color="#456" stop-opacity="0.5"');
    expect(html).toContain('patternUnits="userSpaceOnUse"');
    expect(html).toContain('<feGaussianBlur data-si-primitive="VectorGaussianBlur" stdDeviation="4" result="blur"');
    expect(html).toContain('<feMergeNode data-si-primitive="VectorMergeNode" in="SourceGraphic"');
    expect(html).toContain('type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="17"');
    expect(html).toContain('in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G"');
    expect(html).toContain('filter="url(#glow)"');
    expect(html).toContain('stroke-width="1.3"');
    expect(html).toContain('shape-rendering="crispEdges"');
    expect(html).not.toMatch(/<Vector/);
    expect(lowerSvg(scene())).toContain(html.match(/<defs[^>]*>[\s\S]*?<\/defs>/)![0]);
  });

  it("keeps nested viewport geometry in parent SVG coordinates, including parent transforms", () => {
    const tree = Vector({ width: 400, height: 200, viewBox: { x: 0, y: 0, width: 200, height: 100 } },
      vector.group({ transform: "translate(10 5)" }, scene().children[1]));
    const nodes = walkMediaTree(tree, { width: 400, height: 200 });
    expect(nodes.find(n => n.id === "globe")?.bounds).toEqual({ x: 120, y: 70, width: 80, height: 80 });
    expect(nodes.find(n => n.id === "pixel")?.bounds).toEqual({ x: 92, y: 58, width: 24, height: 24 });
    const nested = lower(scene()).match(/<svg data-si-primitive="VectorViewport"[^>]*>/)?.[0];
    expect(nested).toContain('x="30" y="20" width="80" height="60"');
    expect(nested).not.toContain("position:absolute");
  });

  it("rewrites a bare fill or stroke that names a paint definition in the same vector", () => {
    const html = lower(Vector({ width: 40, height: 40 },
      vector.defs(vector.linearGradient({ id: "sky", x1: 0, y1: 0, x2: 0, y2: 1 },
        vector.stop({ stopColor: "#fff" }))),
      vector.rect({ width: 10, height: 10, fill: "sky", stroke: "sky" }),
      vector.rect({ width: 10, height: 10, fill: "url(#sky)", stroke: "#123" }),
    ));
    expect(html).toContain('fill="url(#sky)"');
    expect(html).toContain('stroke="url(#sky)"');
    expect(html).toContain('stroke="#123"');
    expect(html).not.toContain('fill="sky"');
    expect(html).not.toContain('stroke="sky"');
  });

  it("continues to require purification for typed SVG and escapes authored attribute values", () => {
    const required = vi.fn(), completed = vi.fn();
    const html = lower(Vector({ width: 40, height: 40 },
      vector.defs(vector.pattern({ id: 'x" onload="bad', width: 10, height: 10 },
        vector.circle({ cx: 1, cy: 1, r: 1, fill: '"><script>bad</script>' }))),
      vector.group({ filter: 'x" onload="bad', "data-note": '<img src=x onerror=bad>' },
        vector.rect({ width: 10, height: 10 }))),
      { onPurificationRequired: required, onSerializationComplete: completed });
    expect(required).toHaveBeenCalledTimes(1);
    expect(completed).toHaveBeenCalledExactlyOnceWith(false);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain(' onload="bad');
    expect(html).toContain('&quot; onload=&quot;bad');
  });

  it("does not certify raw attributes slipped into a typed material", () => {
    const completed = vi.fn();
    lower(Vector(h("VectorCircle", { cx: 1, cy: 1, r: 1, onload: "bad" })), { onSerializationComplete: completed });
    expect(completed).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("lowers vector.image into SVG <image> across both lower() and lowerSvg()", () => {
    const tree = Vector(
      { width: 200, height: 100 },
      vector.group(
        { transform: { x: 20, y: 10 } },
        vector.image({
          id: "cutout",
          href: "https://cdn.example.com/hero.png",
          x: 0,
          y: 0,
          width: 60,
          height: 80,
          fit: "contain",
          imageRendering: "pixelated",
        }),
      ),
    );
    for (const markup of [lower(tree), lowerSvg(tree)]) {
      expect(markup).toContain("<image");
      expect(markup).toContain('href="https://cdn.example.com/hero.png"');
      expect(markup).toContain('preserveAspectRatio="xMidYMid meet"');
      expect(markup).toContain('image-rendering="pixelated"');
      expect(markup).not.toContain("<VectorImage");
    }
  });
});
